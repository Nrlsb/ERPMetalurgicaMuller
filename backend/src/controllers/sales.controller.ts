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

const customerSchema = z.object({
  name: z.string().min(2, 'El nombre o razón social es requerido'),
  taxId: z.string().optional(),
  taxType: z.string().default('Consumidor Final'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
});

const saleItemSchema = z.object({
  productId: z.string().min(1, 'El ID de producto es requerido'),
  quantity: z.number().int().min(1, 'La cantidad mínima es 1'),
  unitPrice: z.number().min(0, 'El precio no puede ser negativo'),
  discount: z.number().min(0).default(0),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'El cliente es requerido'),
  orderId: z.string().optional(),
  type: z.enum(['FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'RECIBO_X', 'NOTA_CREDITO', 'NOTA_DEBITO']).default('RECIBO_X'),
  paymentMethod: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CUENTA_CORRIENTE']).default('EFECTIVO'),
  items: z.array(saleItemSchema).min(1, 'Debe incluir al menos un producto'),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0.21), // 21% IVA por defecto
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  paidAmount: z.number().min(0).optional(),
});

const createQuoteSchema = z.object({
  customerId: z.string().min(1, 'El cliente es requerido'),
  validUntil: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Debe incluir al menos un producto'),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0.21),
  notes: z.string().optional(),
});

const registerPaymentSchema = z.object({
  receivableId: z.string().min(1, 'ID de cuenta a cobrar requerido'),
  amount: z.number().positive('El monto a cobrar debe ser mayor a 0'),
  method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA']).default('EFECTIVO'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ==========================================
// 1. CLIENTES (CUSTOMERS)
// ==========================================

export async function getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 50);

    const whereClause: any = { isActive: true };
    if (params.search) {
      whereClause.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { taxId: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where: whereClause }),
      prisma.customer.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { invoices: true, orders: true, quotes: true },
          },
        },
        orderBy: params.sortBy ? { [params.sortBy]: params.sortOrder } : { name: 'asc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(customers, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          include: {
            items: {
              include: { product: { select: { id: true, sku: true, name: true } } },
            },
          },
          orderBy: { issueDate: 'desc' },
          take: 100,
        },
        receivables: {
          where: { isSettled: false },
          include: { payments: true },
        },
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!customer) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      return;
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = customerSchema.parse(req.body);

    const customer = await prisma.$transaction(async (tx) => {
      const code = await generateNextCode(tx, 'CUSTOMER');
      return tx.customer.create({
        data: {
          code,
          name: data.name,
          taxId: data.taxId || null,
          taxType: data.taxType,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          creditLimit: data.creditLimit,
          currentBalance: 0,
        },
      });
    });

    await logSecurityEvent({
      userId: req.user?.userId,
      action: 'CREATE_CUSTOMER',
      module: 'VENTAS',
      entityId: customer.id,
      details: { code: customer.code, name: customer.name },
      req,
    });

    res.status(201).json({ success: true, message: 'Cliente registrado con éxito', data: customer });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = customerSchema.partial().parse(req.body);

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        taxId: data.taxId,
        taxType: data.taxType,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        creditLimit: data.creditLimit,
      },
    });

    res.json({ success: true, message: 'Cliente actualizado con éxito', data: customer });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 2. FACTURACIÓN & VENTAS (SALE INVOICES)
// ==========================================

export async function getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const whereClause: any = {};

    const customerId = req.query.customerId as string | undefined;
    if (customerId && customerId !== 'ALL') {
      whereClause.customerId = customerId;
    }

    if (params.search) {
      whereClause.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
        { customer: { taxId: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, invoices] = await Promise.all([
      prisma.saleInvoice.count({ where: whereClause }),
      prisma.saleInvoice.findMany({
        where: whereClause,
        include: {
          customer: { select: { id: true, name: true, taxId: true, code: true } },
          user: { select: { id: true, fullName: true } },
          items: {
            include: { product: { select: { id: true, sku: true, name: true } } },
          },
          receivable: {
            select: { id: true, balance: true, isSettled: true },
          },
        },
        orderBy: params.sortBy ? { [params.sortBy]: params.sortOrder } : { issueDate: 'desc' },
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

export async function createInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createInvoiceSchema.parse(req.body);
    const userId = req.user?.userId;

    // Verificar cliente
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      res.status(404).json({ success: false, message: 'El cliente especificado no existe' });
      return;
    }

    // Ubicación de stock por defecto
    const defaultLocation = await prisma.stockLocation.findFirst({
      where: { isDefault: true },
    });

    // Validar productos y disponibilidad de stock
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        res.status(400).json({ success: false, message: `Producto con ID ${item.productId} no encontrado` });
        return;
      }
      if (prod.currentStock < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Stock insuficiente para "${prod.name}" (SKU: ${prod.sku}). Disponible: ${prod.currentStock}, Solicitado: ${item.quantity}`,
        });
        return;
      }
    }

    // Cálculos de montos
    let subtotal = 0;
    const invoiceItemsData = data.items.map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: itemSubtotal,
      };
    });

    const subtotalAfterDiscount = subtotal - (data.discount || 0);
    const taxAmount = subtotalAfterDiscount * (data.taxRate || 0);
    const total = subtotalAfterDiscount + taxAmount;

    const isCredit = data.paymentMethod === 'CUENTA_CORRIENTE';
    const paidAmount = isCredit ? (data.paidAmount || 0) : total;
    const isPaid = paidAmount >= total;

    // Ejecución transaccional: Factura + Descuento Stock + Movimiento Kárdex + Cta Cte + Caja
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generar código de factura secuencial seguro
      const code = await generateNextCode(tx, 'SALE_INVOICE');

      // 2. Crear Factura
      const invoice = await tx.saleInvoice.create({
        data: {
          code,
          type: data.type,
          orderId: data.orderId || null,
          customerId: data.customerId,
          userId: userId || null,
          issueDate: new Date(),
          dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
          subtotal,
          discount: data.discount || 0,
          taxAmount,
          total,
          paidAmount,
          isPaid,
          paymentMethod: data.paymentMethod,
          notes: data.notes || null,
          items: {
            create: invoiceItemsData,
          },
        },
        include: { items: true },
      });

      // 3. Descontar Stock de Productos y Registrar Movimiento Kárdex (SALIDA_VENTA)
      const movCode = await generateNextCode(tx, 'STOCK_MOVEMENT');
      const movement = await tx.stockMovement.create({
        data: {
          code: movCode,
          type: 'SALIDA_VENTA',
          originLocationId: defaultLocation?.id || null,
          reference: invoice.code,
          notes: `Venta a ${customer.name} (Factura ${invoice.code})`,
          userId: userId || null,
        },
      });

      for (const item of data.items) {
        const prod = productMap.get(item.productId)!;
        const newStock = prod.currentStock - item.quantity;

        // Actualizar stock general
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: newStock },
        });

        // Actualizar stock por ubicación si existe
        if (defaultLocation) {
          await tx.locationStock.upsert({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: defaultLocation.id,
              },
            },
            update: {
              quantity: { decrement: item.quantity },
            },
            create: {
              productId: item.productId,
              locationId: defaultLocation.id,
              quantity: Math.max(0, newStock),
            },
          });
        }

        // Crear ítem de movimiento
        await tx.stockMovementItem.create({
          data: {
            movementId: movement.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: prod.costPrice,
          },
        });
      }

      // 4. Si no está pagada totalmente o es Cta Cte, generar Cuenta por Cobrar
      if (!isPaid || isCredit) {
        const pendingBalance = total - paidAmount;
        await tx.accountReceivable.create({
          data: {
            invoiceId: invoice.id,
            customerId: customer.id,
            totalAmount: total,
            balance: pendingBalance,
            dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000),
            isSettled: pendingBalance <= 0,
          },
        });

        // Aumentar saldo deudor del cliente
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            currentBalance: { increment: pendingBalance },
          },
        });
      }

      // 5. Si hubo pago inmediato en EFECTIVO, impactar en la Caja Mostrador abierta
      if (paidAmount > 0 && data.paymentMethod === 'EFECTIVO') {
        const openCash = await tx.cashRegister.findFirst({
          where: { isOpen: true },
        });

        if (openCash) {
          await tx.cashRegister.update({
            where: { id: openCash.id },
            data: { balance: { increment: paidAmount } },
          });

          await tx.cashMovement.create({
            data: {
              cashRegisterId: openCash.id,
              type: 'INGRESO_VENTA',
              amount: paidAmount,
              concept: `Cobro por Factura ${invoice.code} - ${customer.name}`,
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
      action: 'CREATE_SALE_INVOICE',
      module: 'VENTAS',
      entityId: result.id,
      details: { code: result.code, total: result.total, customer: customer.name },
      req,
    });

    res.status(201).json({
      success: true,
      message: `Comprobante ${result.code} emitido con éxito`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 3. COTIZACIONES (QUOTES)
// ==========================================

export async function getQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const whereClause: any = {};

    if (params.search) {
      whereClause.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, quotes] = await Promise.all([
      prisma.quote.count({ where: whereClause }),
      prisma.quote.findMany({
        where: whereClause,
        include: {
          customer: { select: { id: true, name: true, taxId: true } },
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
      ...buildPaginatedResponse(quotes, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function createQuote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createQuoteSchema.parse(req.body);

    let subtotal = 0;
    const itemsData = data.items.map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      subtotal += itemSubtotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        subtotal: itemSubtotal,
      };
    });

    const subtotalAfterDiscount = subtotal - (data.discount || 0);
    const taxAmount = subtotalAfterDiscount * (data.taxRate || 0);
    const total = subtotalAfterDiscount + taxAmount;

    const validUntil = data.validUntil
      ? new Date(data.validUntil)
      : new Date(Date.now() + 15 * 24 * 3600 * 1000);

    const quote = await prisma.$transaction(async (tx) => {
      const code = await generateNextCode(tx, 'QUOTE');
      return tx.quote.create({
        data: {
          code,
          customerId: data.customerId,
          validUntil,
          subtotal,
          discount: data.discount || 0,
          taxAmount,
          total,
          notes: data.notes || null,
          status: 'EMITIDA',
          items: {
            create: itemsData,
          },
        },
        include: { items: true, customer: true },
      });
    });

    res.status(201).json({
      success: true,
      message: `Cotización ${quote.code} registrada con éxito`,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateQuoteStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['EMITIDA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA'].includes(status)) {
      res.status(400).json({ success: false, message: 'Estado de cotización inválido' });
      return;
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: { status },
    });

    res.json({ success: true, message: `Cotización actualizada a ${status}`, data: quote });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 4. CUENTAS POR COBRAR & REGISTRO DE PAGOS
// ==========================================

export async function getReceivables(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = parsePaginationParams(req, 30);
    const status = req.query.status as string | undefined;

    const whereClause: any = {};
    if (status === 'PENDING') {
      whereClause.isSettled = false;
    } else if (status === 'SETTLED') {
      whereClause.isSettled = true;
    }

    if (params.search) {
      whereClause.OR = [
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
        { customer: { taxId: { contains: params.search, mode: 'insensitive' } } },
        { invoice: { code: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, receivables] = await Promise.all([
      prisma.accountReceivable.count({ where: whereClause }),
      prisma.accountReceivable.findMany({
        where: whereClause,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true, taxId: true } },
          invoice: { select: { id: true, code: true, issueDate: true, total: true, paymentMethod: true } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
        orderBy: { dueDate: 'asc' },
        skip: params.skip,
        take: params.limit,
      }),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(receivables, total, params),
    });
  } catch (error) {
    next(error);
  }
}

export async function registerPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = registerPaymentSchema.parse(req.body);
    const userId = req.user?.userId;

    const receivable = await prisma.accountReceivable.findUnique({
      where: { id: data.receivableId },
      include: { invoice: true, customer: true },
    });

    if (!receivable) {
      res.status(404).json({ success: false, message: 'Cuenta a cobrar no encontrada' });
      return;
    }

    if (receivable.isSettled) {
      res.status(400).json({ success: false, message: 'Esta cuenta ya se encuentra totalmente saldada' });
      return;
    }

    const currentBalance = Number(receivable.balance);
    if (data.amount > currentBalance) {
      res.status(400).json({
        success: false,
        message: `El monto a cobrar ($${data.amount}) no puede ser mayor al saldo adeudado ($${currentBalance})`,
      });
      return;
    }

    const newBalance = currentBalance - data.amount;
    const isSettled = newBalance <= 0.01;

    const paymentResult = await prisma.$transaction(async (tx) => {
      // 1. Registrar pago recibido
      const payment = await tx.paymentReceivable.create({
        data: {
          receivableId: receivable.id,
          amount: data.amount,
          method: data.method,
          reference: data.reference || null,
          notes: data.notes || null,
        },
      });

      // 2. Actualizar saldo en la cuenta por cobrar
      await tx.accountReceivable.update({
        where: { id: receivable.id },
        data: {
          balance: newBalance,
          isSettled,
        },
      });

      // 3. Actualizar factura correspondiente
      await tx.saleInvoice.update({
        where: { id: receivable.invoiceId },
        data: {
          paidAmount: { increment: data.amount },
          isPaid: isSettled,
        },
      });

      // 4. Reducir saldo deudor del cliente
      await tx.customer.update({
        where: { id: receivable.customerId },
        data: {
          currentBalance: { decrement: data.amount },
        },
      });

      // 5. Si fue en EFECTIVO, ingresar a Caja Mostrador abierta
      if (data.method === 'EFECTIVO') {
        const openCash = await tx.cashRegister.findFirst({
          where: { isOpen: true },
        });

        if (openCash) {
          await tx.cashRegister.update({
            where: { id: openCash.id },
            data: { balance: { increment: data.amount } },
          });

          await tx.cashMovement.create({
            data: {
              cashRegisterId: openCash.id,
              type: 'INGRESO_VENTA',
              amount: data.amount,
              concept: `Cobranza de Factura ${receivable.invoice.code} - ${receivable.customer.name}`,
              reference: data.reference || receivable.invoice.code,
              userId: userId || null,
            },
          });
        }
      }

      return payment;
    });

    await logSecurityEvent({
      userId,
      action: 'REGISTER_CUSTOMER_PAYMENT',
      module: 'VENTAS',
      entityId: paymentResult.id,
      details: {
        invoiceCode: receivable.invoice.code,
        amount: data.amount,
        customer: receivable.customer.name,
      },
      req,
    });

    res.status(201).json({
      success: true,
      message: `Cobranza de $${data.amount.toLocaleString('es-AR')} registrada exitosamente`,
      data: paymentResult,
    });
  } catch (error) {
    next(error);
  }
}
