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

const checkSchema = z.object({
  checkNumber: z.string().min(1, 'El número de cheque es requerido'),
  bank: z.string().min(2, 'El banco es requerido'),
  type: z.enum(['FISICO', 'ECHEQ']).default('FISICO'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  issuer: z.string().min(2, 'El nombre o razón social del emisor es requerido'),
  issuerTaxId: z.string().optional().nullable(),
  issueDate: z.string().optional(),
  paymentDate: z.string().min(1, 'La fecha de cobro es requerida'),
  customerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateCheckSchema = z.object({
  checkNumber: z.string().min(1).optional(),
  bank: z.string().min(2).optional(),
  type: z.enum(['FISICO', 'ECHEQ']).optional(),
  amount: z.number().positive().optional(),
  issuer: z.string().min(2).optional(),
  issuerTaxId: z.string().optional().nullable(),
  issueDate: z.string().optional(),
  paymentDate: z.string().optional(),
  customerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const changeCheckStatusSchema = z.object({
  status: z.enum(['CARTERA', 'DEPOSITADO', 'ENDOSADO', 'RECHAZADO', 'ANULADO']),
  bankAccountId: z.string().optional().nullable(),
  cashRegisterId: z.string().optional().nullable(),
  depositDate: z.string().optional().nullable(),
  endorsedTo: z.string().optional().nullable(),
  endorsementDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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

// ==========================================
// 5. GESTIÓN DE CHEQUES Y CARTERA
// ==========================================

export async function getChecks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, search, type } = req.query;

    const where: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (type && typeof type === 'string' && (type === 'FISICO' || type === 'ECHEQ')) {
      where.type = type;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { checkNumber: { contains: q, mode: 'insensitive' } },
        { bank: { contains: q, mode: 'insensitive' } },
        { issuer: { contains: q, mode: 'insensitive' } },
        { issuerTaxId: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const checks = await (prisma as any).check.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, taxId: true } },
        bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
        cashRegister: { select: { id: true, name: true } },
      },
      orderBy: [
        { paymentDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Calcular métricas para el semáforo y resumen
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let totalCartera = 0;
    let amountCartera = 0;
    let readyToCashCount = 0;
    let readyToCashAmount = 0;
    let upcomingCount = 0;
    let upcomingAmount = 0;
    let deferredCount = 0;
    let deferredAmount = 0;
    let expiredCount = 0;
    let expiredAmount = 0;

    const checksWithMetrics = checks.map((c: any) => {
      const pDate = new Date(c.paymentDate);
      const checkDateOnly = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
      const diffMs = checkDateOnly.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Determinación de semáforo
      let trafficLight: 'GREEN' | 'YELLOW' | 'BLUE' | 'RED' | 'SETTLED' = 'SETTLED';
      let trafficLightLabel = '';

      if (c.status === 'CARTERA') {
        totalCartera++;
        amountCartera += Number(c.amount);

        if (diffDays > 7) {
          trafficLight = 'BLUE';
          trafficLightLabel = `Diferido (faltan ${diffDays} días)`;
          deferredCount++;
          deferredAmount += Number(c.amount);
        } else if (diffDays >= 1 && diffDays <= 7) {
          trafficLight = 'YELLOW';
          trafficLightLabel = `Próximo (en ${diffDays} ${diffDays === 1 ? 'día' : 'días'})`;
          upcomingCount++;
          upcomingAmount += Number(c.amount);
        } else if (diffDays <= 0 && diffDays >= -30) {
          trafficLight = 'GREEN';
          trafficLightLabel = diffDays === 0 ? '¡Habilitado para cobrar hoy!' : `Listo para cobrar (hace ${Math.abs(diffDays)} días)`;
          readyToCashCount++;
          readyToCashAmount += Number(c.amount);
        } else {
          trafficLight = 'RED';
          trafficLightLabel = 'Vencido (+30 días sin cobrar)';
          expiredCount++;
          expiredAmount += Number(c.amount);
        }
      } else if (c.status === 'DEPOSITADO') {
        trafficLight = 'SETTLED';
        trafficLightLabel = 'Depositado / Cobrado';
      } else if (c.status === 'ENDOSADO') {
        trafficLight = 'SETTLED';
        trafficLightLabel = `Endosado a ${c.endorsedTo || 'Tercero'}`;
      } else if (c.status === 'RECHAZADO') {
        trafficLight = 'RED';
        trafficLightLabel = 'Rechazado';
      } else if (c.status === 'ANULADO') {
        trafficLight = 'SETTLED';
        trafficLightLabel = 'Anulado';
      }

      return {
        ...c,
        diffDays,
        trafficLight,
        trafficLightLabel,
      };
    });

    res.json({
      success: true,
      data: checksWithMetrics,
      summary: {
        totalCartera,
        amountCartera,
        readyToCash: { count: readyToCashCount, amount: readyToCashAmount },
        upcoming: { count: upcomingCount, amount: upcomingAmount },
        deferred: { count: deferredCount, amount: deferredAmount },
        expired: { count: expiredCount, amount: expiredAmount },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createCheck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = checkSchema.parse(req.body);

    const check = await (prisma as any).check.create({
      data: {
        checkNumber: data.checkNumber,
        bank: data.bank,
        type: data.type,
        amount: data.amount,
        issuer: data.issuer,
        issuerTaxId: data.issuerTaxId || null,
        issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
        paymentDate: new Date(data.paymentDate),
        customerId: data.customerId || null,
        notes: data.notes || null,
        status: 'CARTERA',
      },
      include: {
        customer: { select: { id: true, name: true, taxId: true } },
      },
    });

    await logSecurityEvent({
      action: 'CHECK_CREATED',
      resource: `Check #${check.checkNumber}`,
      userId: req.user?.userId,
      details: { checkId: check.id, amount: data.amount, bank: data.bank },
    });

    res.status(201).json({ success: true, message: 'Cheque registrado exitosamente', data: check });
  } catch (error) {
    next(error);
  }
}

export async function updateCheck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateCheckSchema.parse(req.body);

    const existing = await (prisma as any).check.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Cheque no encontrado' });
      return;
    }

    const updateData: any = {};
    if (data.checkNumber !== undefined) updateData.checkNumber = data.checkNumber;
    if (data.bank !== undefined) updateData.bank = data.bank;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.issuer !== undefined) updateData.issuer = data.issuer;
    if (data.issuerTaxId !== undefined) updateData.issuerTaxId = data.issuerTaxId;
    if (data.issueDate !== undefined) updateData.issueDate = new Date(data.issueDate);
    if (data.paymentDate !== undefined) updateData.paymentDate = new Date(data.paymentDate);
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await (prisma as any).check.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, taxId: true } },
        bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
        cashRegister: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, message: 'Cheque actualizado exitosamente', data: updated });
  } catch (error) {
    next(error);
  }
}

export async function changeCheckStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = changeCheckStatusSchema.parse(req.body);

    const check = await (prisma as any).check.findUnique({ where: { id } });
    if (!check) {
      res.status(404).json({ success: false, message: 'Cheque no encontrado' });
      return;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      let updatePayload: any = {
        status: data.status,
      };

      if (data.notes) {
        updatePayload.notes = check.notes ? `${check.notes} | ${data.notes}` : data.notes;
      }

      if (data.status === 'DEPOSITADO') {
        const depDate = data.depositDate ? new Date(data.depositDate) : new Date();
        updatePayload.depositDate = depDate;

        if (data.bankAccountId) {
          const account = await tx.bankAccount.findUnique({ where: { id: data.bankAccountId } });
          if (!account) throw new Error('Cuenta bancaria no encontrada');

          updatePayload.bankAccountId = data.bankAccountId;

          // Registrar transacción bancaria de crédito
          await tx.bankTransaction.create({
            data: {
              bankAccountId: data.bankAccountId,
              type: 'CREDITO',
              amount: check.amount,
              concept: `Acreditación Cheque #${check.checkNumber} (${check.bank})`,
              reference: check.checkNumber,
              date: depDate,
            },
          });

          // Incrementar saldo de la cuenta bancaria
          await tx.bankAccount.update({
            where: { id: data.bankAccountId },
            data: { balance: { increment: check.amount } },
          });
        } else if (data.cashRegisterId) {
          const register = await tx.cashRegister.findUnique({ where: { id: data.cashRegisterId } });
          if (!register) throw new Error('Caja no encontrada');
          if (!register.isOpen) throw new Error('La caja seleccionada debe estar abierta');

          updatePayload.cashRegisterId = data.cashRegisterId;

          // Registrar ingreso en caja
          await tx.cashMovement.create({
            data: {
              cashRegisterId: data.cashRegisterId,
              type: 'INGRESO_OTRO',
              amount: check.amount,
              concept: `Cobro en ventanilla Cheque #${check.checkNumber} (${check.bank})`,
              reference: check.checkNumber,
              userId: req.user?.userId || null,
            },
          });

          // Incrementar saldo de la caja
          await tx.cashRegister.update({
            where: { id: data.cashRegisterId },
            data: { balance: { increment: check.amount } },
          });
        }
      } else if (data.status === 'ENDOSADO') {
        updatePayload.endorsedTo = data.endorsedTo || 'Tercero / Proveedor';
        updatePayload.endorsementDate = data.endorsementDate ? new Date(data.endorsementDate) : new Date();
      }

      const updated = await tx.check.update({
        where: { id },
        data: updatePayload,
        include: {
          customer: { select: { id: true, name: true } },
          bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
          cashRegister: { select: { id: true, name: true } },
        },
      });

      return updated;
    });

    await logSecurityEvent({
      action: 'CHECK_STATUS_CHANGED',
      resource: `Check #${check.checkNumber}`,
      userId: req.user?.userId,
      details: { checkId: check.id, newStatus: data.status },
    });

    res.json({ success: true, message: `Estado del cheque actualizado a ${data.status}`, data: result });
  } catch (error: any) {
    if (error.message && (error.message.includes('Caja') || error.message.includes('Cuenta bancaria'))) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function deleteCheck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const check = await (prisma as any).check.findUnique({ where: { id } });
    if (!check) {
      res.status(404).json({ success: false, message: 'Cheque no encontrado' });
      return;
    }

    if (check.status === 'DEPOSITADO') {
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar un cheque ya depositado o cobrado. Se debe revertir su estado previamente.',
      });
      return;
    }

    await (prisma as any).check.delete({ where: { id } });

    await logSecurityEvent({
      action: 'CHECK_DELETED',
      resource: `Check #${check.checkNumber}`,
      userId: req.user?.userId,
      details: { checkId: check.id },
    });

    res.json({ success: true, message: 'Cheque eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
}
