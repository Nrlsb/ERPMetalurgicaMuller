import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logSecurityEvent } from '../lib/audit';
import { parsePaginationParams, buildPaginatedResponse } from '../lib/pagination';
import { generateNextCode } from '../lib/sequence';

// ==========================================
// VALIDACIONES ZOD
// ==========================================

const supplierSchema = z.object({
  companyName: z.string().min(2, 'La razón social o nombre del proveedor es requerida'),
  contactName: z.string().optional(),
  taxId: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().default('Contado'),
});

const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'El ID de producto es requerido'),
  quantity: z.number().int().min(1, 'La cantidad mínima es 1'),
  unitCost: z.number().min(0, 'El costo unitario no puede ser negativo'),
});

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'El proveedor es requerido'),
  expectedDate: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Debe incluir al menos un ítem'),
  notes: z.string().optional(),
  taxRate: z.number().min(0).default(0.21),
});

const createPurchaseInvoiceSchema = z.object({
  supplierId: z.string().min(1, 'El proveedor es requerido'),
  orderId: z.string().optional(),
  code: z.string().min(1, 'El número de factura del proveedor es requerido'),
  items: z.array(purchaseItemSchema).min(1, 'Debe incluir al menos un producto a ingresar'),
  taxRate: z.number().min(0).default(0.21),
  dueDate: z.string().optional(),
  paidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'CUENTA_CORRIENTE']).default('EFECTIVO'),
});

const registerSupplierPaymentSchema = z.object({
  payableId: z.string().min(1, 'ID de cuenta a pagar requerido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE']).default('EFECTIVO'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ==========================================
// 1. PROVEEDORES (SUPPLIERS)
// ==========================================

export async function getSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 50);
    const whereClause: any = { isActive: true };

    if (params.search) {
      whereClause.OR = [
        { companyName: { contains: params.search, mode: 'insensitive' } },
        { contactName: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { taxId: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where: whereClause }),
      prisma.supplier.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { purchaseOrders: true, purchaseInvoices: true },
          },
        },
        orderBy: params.sortBy ? { [params.sortBy]: params.sortOrder } : { companyName: 'asc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(suppliers, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = supplierSchema.parse(req.body);

    const supplier = await prisma.$transaction(async (tx) => {
      const code = await generateNextCode(tx, 'SUPPLIER');
      return tx.supplier.create({
        data: {
          code,
          companyName: data.companyName,
          contactName: data.contactName || null,
          taxId: data.taxId || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          paymentTerms: data.paymentTerms,
        },
      });
    });

    await logSecurityEvent({
      userId: req.user?.userId,
      action: 'CREATE_SUPPLIER',
      module: 'COMPRAS',
      entityId: supplier.id,
      details: { code: supplier.code, name: supplier.companyName },
      req,
    });

    res.status(201).json({ success: true, message: 'Proveedor registrado exitosamente', data: supplier });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 2. ÓRDENES DE COMPRA (PURCHASE ORDERS)
// ==========================================

export async function getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const whereClause: any = {};

    if (params.search) {
      whereClause.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { supplier: { companyName: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.purchaseOrder.count({ where: whereClause }),
      prisma.purchaseOrder.findMany({
        where: whereClause,
        include: {
          supplier: { select: { id: true, companyName: true, taxId: true, code: true } },
          items: {
            include: { product: { select: { id: true, sku: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(orders, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createPurchaseOrderSchema.parse(req.body);

    let subtotal = 0;
    const itemsData = data.items.map((item) => {
      const itemSubtotal = item.quantity * item.unitCost;
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        subtotal: itemSubtotal,
      };
    });

    const taxAmount = subtotal * data.taxRate;
    const total = subtotal + taxAmount;

    const order = await prisma.$transaction(async (tx) => {
      const code = await generateNextCode(tx, 'PURCHASE_ORDER');
      return tx.purchaseOrder.create({
        data: {
          code,
          supplierId: data.supplierId,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          subtotal,
          taxAmount,
          total,
          status: 'PENDIENTE',
          notes: data.notes || null,
          items: {
            create: itemsData,
          },
        },
        include: { items: true, supplier: true },
      });
    });

    res.status(201).json({ success: true, message: `Orden de Compra ${order.code} generada`, data: order });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 3. FACTURAS DE COMPRA & INGRESO A STOCK
// ==========================================

export async function getPurchaseInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const whereClause: any = {};

    if (params.search) {
      whereClause.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { supplier: { companyName: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, invoices] = await Promise.all([
      prisma.purchaseInvoice.count({ where: whereClause }),
      prisma.purchaseInvoice.findMany({
        where: whereClause,
        include: {
          supplier: { select: { id: true, companyName: true, taxId: true, code: true } },
          items: {
            include: { product: { select: { id: true, sku: true, name: true } } },
          },
          payable: {
            select: { id: true, balance: true, isSettled: true },
          },
        },
        orderBy: { issueDate: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(invoices, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createPurchaseInvoiceSchema.parse(req.body);
    const userId = req.user?.userId;

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
      return;
    }

    const defaultLocation = await prisma.stockLocation.findFirst({
      where: { isDefault: true },
    });

    let subtotal = 0;
    const itemsData = data.items.map((item) => {
      const itemSubtotal = item.quantity * item.unitCost;
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        subtotal: itemSubtotal,
      };
    });

    const taxAmount = subtotal * data.taxRate;
    const total = subtotal + taxAmount;

    const isCredit = data.paymentMethod === 'CUENTA_CORRIENTE';
    const paidAmount = isCredit ? (data.paidAmount || 0) : total;
    const isPaid = paidAmount >= total;

    // Transacción: Factura de Compra + Ingreso a Stock + Movimiento Kárdex (ENTRADA_COMPRA) + Cta a Pagar + Caja
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Factura de Compra
      const invoice = await tx.purchaseInvoice.create({
        data: {
          code: data.code,
          orderId: data.orderId || null,
          supplierId: data.supplierId,
          userId: userId || null,
          issueDate: new Date(),
          dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
          subtotal,
          taxAmount,
          total,
          paidAmount,
          isPaid,
          items: {
            create: itemsData,
          },
        },
      });

      // 2. Si venía de una orden de compra, actualizar estado
      if (data.orderId) {
        await tx.purchaseOrder.update({
          where: { id: data.orderId },
          data: { status: 'RECIBIDA' },
        });
      }

      // 3. Incrementar Stock y registrar Movimiento Kárdex (ENTRADA_COMPRA)
      const movCode = await generateNextCode(tx, 'STOCK_MOVEMENT');
      const movement = await tx.stockMovement.create({
        data: {
          code: movCode,
          type: 'ENTRADA_COMPRA',
          destLocationId: defaultLocation?.id || null,
          reference: `FC Proveedor ${invoice.code}`,
          notes: `Recepción de mercadería de ${supplier.companyName}`,
          userId: userId || null,
        },
      });

      for (const item of data.items) {
        // Actualizar stock general y actualizar precio de costo
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: item.quantity },
            costPrice: item.unitCost, // Actualizar último costo de adquisición
          },
        });

        // Actualizar stock de depósito
        if (defaultLocation) {
          await tx.locationStock.upsert({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: defaultLocation.id,
              },
            },
            update: {
              quantity: { increment: item.quantity },
            },
            create: {
              productId: item.productId,
              locationId: defaultLocation.id,
              quantity: item.quantity,
            },
          });
        }

        // Crear ítem de movimiento
        await tx.stockMovementItem.create({
          data: {
            movementId: movement.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          },
        });
      }

      // 4. Si es a crédito o no está totalmente abonada, generar Cuenta por Pagar
      if (!isPaid || isCredit) {
        const pendingBalance = total - paidAmount;
        await tx.accountPayable.create({
          data: {
            invoiceId: invoice.id,
            supplierId: supplier.id,
            totalAmount: total,
            balance: pendingBalance,
            dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000),
            isSettled: pendingBalance <= 0,
          },
        });
      }

      // 5. Si hubo egreso inmediato en efectivo, impactar en Caja
      if (paidAmount > 0 && data.paymentMethod === 'EFECTIVO') {
        const openCash = await tx.cashRegister.findFirst({
          where: { isOpen: true },
        });

        if (openCash) {
          await tx.cashRegister.update({
            where: { id: openCash.id },
            data: { balance: { decrement: paidAmount } },
          });

          await tx.cashMovement.create({
            data: {
              cashRegisterId: openCash.id,
              type: 'EGRESO_COMPRA',
              amount: paidAmount,
              concept: `Pago Compra FC ${invoice.code} - ${supplier.companyName}`,
              reference: invoice.code,
              userId: userId || null,
            },
          });
        }
      }

      return invoice;
    });

    await logSecurityEvent({
      userId,
      action: 'CREATE_PURCHASE_INVOICE',
      module: 'COMPRAS',
      entityId: result.id,
      details: { invoiceCode: result.code, total: result.total, supplier: supplier.companyName },
      req,
    });

    res.status(201).json({
      success: true,
      message: `Comprobante de compra y recepción de mercadería procesados exitosamente`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 4. CUENTAS POR PAGAR & PAGOS A PROVEEDORES
// ==========================================

export async function getPayables(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const whereClause: any = {};

    if (params.search) {
      whereClause.OR = [
        { supplier: { companyName: { contains: params.search, mode: 'insensitive' } } },
        { invoice: { code: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, payables] = await Promise.all([
      prisma.accountPayable.count({ where: whereClause }),
      prisma.accountPayable.findMany({
        where: whereClause,
        include: {
          supplier: { select: { id: true, companyName: true, phone: true, email: true, taxId: true } },
          invoice: { select: { id: true, code: true, issueDate: true, total: true } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
        orderBy: { dueDate: 'asc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(payables, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function registerSupplierPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = registerSupplierPaymentSchema.parse(req.body);
    const userId = req.user?.userId;

    const payable = await prisma.accountPayable.findUnique({
      where: { id: data.payableId },
      include: { invoice: true, supplier: true },
    });

    if (!payable) {
      res.status(404).json({ success: false, message: 'Cuenta a pagar no encontrada' });
      return;
    }

    if (payable.isSettled) {
      res.status(400).json({ success: false, message: 'Esta deuda ya se encuentra saldada' });
      return;
    }

    const currentBalance = Number(payable.balance);
    if (data.amount > currentBalance) {
      res.status(400).json({
        success: false,
        message: `El monto a pagar ($${data.amount}) no puede superar el saldo pendiente ($${currentBalance})`,
      });
      return;
    }

    const newBalance = currentBalance - data.amount;
    const isSettled = newBalance <= 0.01;

    const paymentResult = await prisma.$transaction(async (tx) => {
      const payment = await tx.paymentPayable.create({
        data: {
          payableId: payable.id,
          amount: data.amount,
          method: data.method,
          reference: data.reference || null,
          notes: data.notes || null,
        },
      });

      await tx.accountPayable.update({
        where: { id: payable.id },
        data: {
          balance: newBalance,
          isSettled,
        },
      });

      await tx.purchaseInvoice.update({
        where: { id: payable.invoiceId },
        data: {
          paidAmount: { increment: data.amount },
          isPaid: isSettled,
        },
      });

      if (data.method === 'EFECTIVO') {
        const openCash = await tx.cashRegister.findFirst({
          where: { isOpen: true },
        });

        if (openCash) {
          await tx.cashRegister.update({
            where: { id: openCash.id },
            data: { balance: { decrement: data.amount } },
          });

          await tx.cashMovement.create({
            data: {
              cashRegisterId: openCash.id,
              type: 'EGRESO_COMPRA',
              amount: data.amount,
              concept: `Pago a Proveedor ${payable.supplier.companyName} (FC ${payable.invoice.code})`,
              reference: data.reference || payable.invoice.code,
              userId: userId || null,
            },
          });
        }
      }

      return payment;
    });

    await logSecurityEvent({
      userId,
      action: 'REGISTER_SUPPLIER_PAYMENT',
      module: 'COMPRAS',
      entityId: paymentResult.id,
      details: {
        supplier: payable.supplier.companyName,
        amount: data.amount,
        invoiceCode: payable.invoice.code,
      },
      req,
    });

    res.status(201).json({
      success: true,
      message: `Pago de $${data.amount.toLocaleString('es-AR')} a ${payable.supplier.companyName} registrado con éxito`,
      data: paymentResult,
    });
  } catch (error) {
    next(error);
  }
}
