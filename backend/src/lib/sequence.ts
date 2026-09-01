import { PrismaClient } from '@prisma/client';

type SequenceType =
  | 'CUSTOMER'
  | 'SALE_INVOICE'
  | 'QUOTE'
  | 'SUPPLIER'
  | 'PURCHASE_ORDER'
  | 'STOCK_MOVEMENT'
  | 'PRODUCTION_ORDER';

/**
 * Genera códigos correlativos seguros y legibles evitando duplicados
 */
export async function generateNextCode(
  prismaClient: any,
  type: SequenceType,
  prefixOverride?: string
): Promise<string> {
  const year = new Date().getFullYear();

  switch (type) {
    case 'CUSTOMER': {
      const last = await prismaClient.customer.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });
      let nextNum = 1;
      if (last?.code) {
        const match = last.code.match(/\d+/);
        if (match) nextNum = parseInt(match[0], 10) + 1;
      }
      return `${prefixOverride || 'CLI'}-${String(nextNum).padStart(4, '0')}`;
    }

    case 'SUPPLIER': {
      const last = await prismaClient.supplier.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });
      let nextNum = 1;
      if (last?.code) {
        const match = last.code.match(/\d+/);
        if (match) nextNum = parseInt(match[0], 10) + 1;
      }
      return `${prefixOverride || 'PROV'}-${String(nextNum).padStart(4, '0')}`;
    }

    case 'SALE_INVOICE': {
      const last = await prismaClient.saleInvoice.findFirst({
        where: {
          code: { startsWith: `FAC-${year}-` },
        },
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });
      let nextNum = 1;
      if (last?.code) {
        const parts = last.code.split('-');
        if (parts.length >= 3) {
          const numPart = parseInt(parts[2], 10);
          if (!isNaN(numPart)) nextNum = numPart + 1;
        }
      }
      return `${prefixOverride || 'FAC'}-${year}-${String(nextNum).padStart(8, '0')}`;
    }

    case 'QUOTE': {
      const last = await prismaClient.quote.findFirst({
        where: {
          code: { startsWith: `COT-${year}-` },
        },
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });
      let nextNum = 1;
      if (last?.code) {
        const parts = last.code.split('-');
        if (parts.length >= 3) {
          const numPart = parseInt(parts[2], 10);
          if (!isNaN(numPart)) nextNum = numPart + 1;
        }
      }
      return `${prefixOverride || 'COT'}-${year}-${String(nextNum).padStart(4, '0')}`;
    }

    case 'PURCHASE_ORDER': {
      const last = await prismaClient.purchaseOrder.findFirst({
        where: {
          code: { startsWith: `OC-${year}-` },
        },
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });
      let nextNum = 1;
      if (last?.code) {
        const parts = last.code.split('-');
        if (parts.length >= 3) {
          const numPart = parseInt(parts[2], 10);
          if (!isNaN(numPart)) nextNum = numPart + 1;
        }
      }
      return `${prefixOverride || 'OC'}-${year}-${String(nextNum).padStart(4, '0')}`;
    }

    case 'PRODUCTION_ORDER': {
      const last = await prismaClient.productionOrder.findFirst({
        where: {
          code: { startsWith: `FAB-${year}-` },
        },
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });
      let nextNum = 1;
      if (last?.code) {
        const parts = last.code.split('-');
        if (parts.length >= 3) {
          const numPart = parseInt(parts[2], 10);
          if (!isNaN(numPart)) nextNum = numPart + 1;
        }
      }
      return `${prefixOverride || 'FAB'}-${year}-${String(nextNum).padStart(4, '0')}`;
    }

    case 'STOCK_MOVEMENT': {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `MOV-${year}-${timestamp}${random}`;
    }

    default:
      return `COD-${Date.now()}`;
  }
}
