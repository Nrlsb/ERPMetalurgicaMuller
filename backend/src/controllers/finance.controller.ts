import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logSecurityEvent } from '../lib/audit';
import { parsePaginationParams, buildPaginatedResponse } from '../lib/pagination';

// ==========================================
// VALIDACIONES ZOD
// ==========================================

const cashMovementSchema = z.object({
  cashRegisterId: z.string().min(1, 'La caja es requerida'),
  type: z.enum(['INGRESO_OTRO', 'EGRESO_GASTO', 'RETIRO', 'APORTE']),
  amount: z.number().positive('El monto debe ser positivo'),
  concept: z.string().min(2, 'El concepto es requerido'),
  reference: z.string().optional(),
});

const openCashSchema = z.object({
  initialBalance: z.number().min(0).default(0),
});

const closeCashSchema = z.object({
  countedBalance: z.number().min(0),
  notes: z.string().optional(),
});

const expenseSchema = z.object({
  categoryId: z.string().min(1, 'La categoría de gasto es requerida'),
  concept: z.string().min(2, 'El concepto es requerido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  dueDate: z.string().optional(),
  paymentDate: z.string().optional(),
  isPaid: z.boolean().default(true),
  payFromCashRegisterId: z.string().optional(),
  notes: z.string().optional(),
});

const bankAccountSchema = z.object({
  bankName: z.string().min(2, 'El nombre del banco es requerido'),
  accountNumber: z.string().min(2, 'El número de cuenta es requerido'),
  accountType: z.string().default('Cuenta Corriente'),
  cbu: z.string().optional(),
  alias: z.string().optional(),
  initialBalance: z.number().min(0).default(0),
});

const bankTransactionSchema = z.object({
  bankAccountId: z.string().min(1, 'La cuenta bancaria es requerida'),
  type: z.enum(['CREDITO', 'DEBITO']),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  concept: z.string().min(2, 'El concepto es requerido'),
  reference: z.string().optional(),
});

// ==========================================
// 1. CONTROL DE CAJAS (CASH REGISTERS)
// ==========================================

export async function getCashRegisters(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const registers = await prisma.cashRegister.findMany({
      include: {
        movements: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: registers });
  } catch (error) {
    next(error);
  }
}

export async function openCashRegister(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = openCashSchema.parse(req.body);
    const userId = req.user?.userId;

    const register = await prisma.cashRegister.findUnique({ where: { id } });
    if (!register) {
      res.status(404).json({ success: false, message: 'Caja no encontrada' });
      return;
    }

    if (register.isOpen) {
      res.status(400).json({ success: false, message: 'La caja ya se encuentra abierta' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reg = await tx.cashRegister.update({
        where: { id },
        data: {
          isOpen: true,
          balance: data.initialBalance,
        },
      });

      if (data.initialBalance > 0) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: reg.id,
            type: 'APORTE',
            amount: data.initialBalance,
            concept: 'Apertura de turno - Fondo inicial',
            userId: userId || null,
          },
        });
      }

      return reg;
    });

    await logSecurityEvent({
      userId,
      action: 'OPEN_CASH_REGISTER',
      module: 'FINANZAS',
      entityId: id,
      details: { registerName: register.name, initialBalance: data.initialBalance },
      req,
    });

    res.json({ success: true, message: `Caja "${register.name}" abierta con éxito`, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function closeCashRegister(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = closeCashSchema.parse(req.body);
    const userId = req.user?.userId;

    const register = await prisma.cashRegister.findUnique({ where: { id } });
    if (!register) {
      res.status(404).json({ success: false, message: 'Caja no encontrada' });
      return;
    }

    if (!register.isOpen) {
      res.status(400).json({ success: false, message: 'La caja ya está cerrada' });
      return;
    }

    const systemBalance = Number(register.balance);
    const difference = data.countedBalance - systemBalance;

    const updated = await prisma.$transaction(async (tx) => {
      const reg = await tx.cashRegister.update({
        where: { id },
        data: {
          isOpen: false,
          balance: 0,
        },
      });

      await tx.cashMovement.create({
        data: {
          cashRegisterId: reg.id,
          type: 'RETIRO',
          amount: data.countedBalance,
          concept: `Cierre de Turno / Arqueo (Diferencia: ${difference >= 0 ? '+' : ''}$${difference.toLocaleString('es-AR')})`,
          reference: data.notes || 'Arqueo Cierre',
          userId: userId || null,
        },
      });

      return reg;
    });

    await logSecurityEvent({
      userId,
      action: 'CLOSE_CASH_REGISTER',
      module: 'FINANZAS',
      entityId: id,
      details: {
        registerName: register.name,
        systemBalance,
        countedBalance: data.countedBalance,
        difference,
      },
      req,
    });

    res.json({
      success: true,
      message: `Caja cerrada. Arqueo: $${data.countedBalance.toLocaleString('es-AR')}. Diferencia: $${difference.toLocaleString('es-AR')}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 2. MOVIMIENTOS DE CAJA (CASH MOVEMENTS)
// ==========================================

export async function getCashMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const registerId = req.query.cashRegisterId as string | undefined;

    const whereClause: any = {};
    if (registerId) {
      whereClause.cashRegisterId = registerId;
    }
    if (params.search) {
      whereClause.OR = [
        { concept: { contains: params.search, mode: 'insensitive' } },
        { reference: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, movements] = await Promise.all([
      prisma.cashMovement.count({ where: whereClause }),
      prisma.cashMovement.findMany({
        where: whereClause,
        include: {
          cashRegister: { select: { name: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(movements, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCashMovement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = cashMovementSchema.parse(req.body);
    const userId = req.user?.userId;

    const register = await prisma.cashRegister.findUnique({ where: { id: data.cashRegisterId } });
    if (!register) {
      res.status(404).json({ success: false, message: 'Caja no encontrada' });
      return;
    }

    if (!register.isOpen) {
      res.status(400).json({ success: false, message: 'No se pueden registrar movimientos en una caja cerrada' });
      return;
    }

    const isIngreso = data.type === 'INGRESO_OTRO' || data.type === 'APORTE';

    if (!isIngreso && Number(register.balance) < data.amount) {
      res.status(400).json({
        success: false,
        message: `Saldo insuficiente en caja ($${Number(register.balance)}) para egreso de $${data.amount}`,
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          cashRegisterId: data.cashRegisterId,
          type: data.type,
          amount: data.amount,
          concept: data.concept,
          reference: data.reference || null,
          userId: userId || null,
        },
      });

      await tx.cashRegister.update({
        where: { id: data.cashRegisterId },
        data: {
          balance: isIngreso ? { increment: data.amount } : { decrement: data.amount },
        },
      });

      return movement;
    });

    res.status(201).json({ success: true, message: 'Movimiento registrado con éxito', data: result });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 3. GASTOS OPERATIVOS (EXPENSES)
// ==========================================

export async function getExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const categoryId = req.query.categoryId as string | undefined;

    const whereClause: any = {};
    if (categoryId && categoryId !== 'ALL') {
      whereClause.categoryId = categoryId;
    }
    if (params.search) {
      whereClause.OR = [
        { concept: { contains: params.search, mode: 'insensitive' } },
        { notes: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where: whereClause }),
      prisma.expense.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(expenses, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function getExpenseCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await prisma.expenseCategory.findMany({
      include: {
        _count: { select: { expenses: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

export async function createExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = expenseSchema.parse(req.body);
    const userId = req.user?.userId;

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          categoryId: data.categoryId,
          concept: data.concept,
          amount: data.amount,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          paymentDate: data.isPaid ? (data.paymentDate ? new Date(data.paymentDate) : new Date()) : null,
          isPaid: data.isPaid,
          notes: data.notes || null,
        },
      });

      if (data.isPaid && data.payFromCashRegisterId) {
        const cash = await tx.cashRegister.findUnique({ where: { id: data.payFromCashRegisterId } });
        if (cash && cash.isOpen) {
          await tx.cashRegister.update({
            where: { id: cash.id },
            data: { balance: { decrement: data.amount } },
          });

          await tx.cashMovement.create({
            data: {
              cashRegisterId: cash.id,
              type: 'EGRESO_GASTO',
              amount: data.amount,
              concept: `Gasto: ${data.concept}`,
              reference: `EXP-${expense.id.slice(0, 6)}`,
              userId: userId || null,
            },
          });
        }
      }

      return expense;
    });

    res.status(201).json({ success: true, message: 'Gasto registrado con éxito', data: result });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 4. CUENTAS BANCARIAS (BANK ACCOUNTS)
// ==========================================

export async function getBankAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accounts = await prisma.bankAccount.findMany({
      include: {
        transactions: {
          take: 10,
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { bankName: 'asc' },
    });

    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
}

export async function createBankAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = bankAccountSchema.parse(req.body);

    const account = await prisma.bankAccount.create({
      data: {
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        cbu: data.cbu || null,
        alias: data.alias || null,
        balance: data.initialBalance,
      },
    });

    res.status(201).json({ success: true, message: 'Cuenta bancaria añadida', data: account });
  } catch (error) {
    next(error);
  }
}

export async function createBankTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = bankTransactionSchema.parse(req.body);

    const isCredito = data.type === 'CREDITO';

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.bankTransaction.create({
        data: {
          bankAccountId: data.bankAccountId,
          type: data.type,
          amount: data.amount,
          concept: data.concept,
          reference: data.reference || null,
        },
      });

      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: {
          balance: isCredito ? { increment: data.amount } : { decrement: data.amount },
        },
      });

      return transaction;
    });

    res.status(201).json({ success: true, message: 'Transacción bancaria registrada', data: result });
  } catch (error) {
    next(error);
  }
}
