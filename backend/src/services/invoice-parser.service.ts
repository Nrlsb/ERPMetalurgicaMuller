import zlib from 'zlib';
import { prisma } from '../lib/prisma';

export interface ParsedInvoiceItem {
  supplierCode: string;
  description: string;
  quantity: number;
  unitCost: number;
  total: number;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedProductSku?: string;
  isMatched: boolean;
}

export interface ParsedInvoiceResult {
  supplierId?: string;
  supplierName?: string;
  supplierTaxId?: string;
  supplierFound: boolean;
  invoiceCode?: string;
  invoiceDate?: string;
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'CUENTA_CORRIENTE' | 'CHEQUE';
  items: ParsedInvoiceItem[];
  subtotal?: number;
  total?: number;
  rawTextPreview: string;
}

/**
 * Extrae texto del Buffer del PDF usando pdf-parse si está disponible,
 * o un extractor nativo de streams FlateDecode de Node.js como fallback.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    if (data && data.text && data.text.trim().length > 0) {
      return data.text;
    }
  } catch (err) {
    // Fallback nativo
  }

  return extractPdfTextNative(buffer);
}

/**
 * Fallback nativo de bajo nivel que descomprime streams FlateDecode
 * y extrae operadores de texto Tj / TJ estándar de PDF.
 */
function extractPdfTextNative(buffer: Buffer): string {
  const content = buffer.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let fullText = '';

  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = Buffer.from(match[1], 'binary');
    let uncompressed = '';

    try {
      uncompressed = zlib.inflateSync(rawStream).toString('latin1');
    } catch {
      try {
        uncompressed = zlib.inflateRawSync(rawStream).toString('latin1');
      } catch {
        uncompressed = rawStream.toString('latin1');
      }
    }

    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(uncompressed)) !== null) {
      fullText += decodePdfString(tjMatch[1]) + ' ';
    }

    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = tjArrayRegex.exec(uncompressed)) !== null) {
      const innerTj = /\(([^)]*)\)/g;
      let innerMatch: RegExpExecArray | null;
      let word = '';
      while ((innerMatch = innerTj.exec(arrayMatch[1])) !== null) {
        word += decodePdfString(innerMatch[1]);
      }
      fullText += word + ' ';
    }

    fullText += '\n';
  }

  return fullText;
}

function decodePdfString(str: string): string {
  return str
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

/**
 * Normaliza montos en formato numérico argentino/español:
 * ej. "120.743,03" -> 120743.03  ó "3859,71" -> 3859.71
 */
function parseLocaleNumber(valStr: string): number {
  if (!valStr) return 0;
  let clean = valStr.trim().replace(/\$/g, '').trim();
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function cleanCuit(cuit: string): string {
  return cuit.replace(/\D/g, '');
}

/**
 * Parsea el texto extraído de la factura PDF y cruza los datos con la base de datos
 */
export async function parseInvoicePdfBuffer(buffer: Buffer): Promise<ParsedInvoiceResult> {
  const text = await extractTextFromPdf(buffer);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Extraer CUIT del emisor / proveedor
  let detectedCuit: string | undefined;
  const cuitRegex = /(?:C\.?U\.?I\.?T\.?:?\s*)(\d{2}-?\d{8}-?\d{1})/i;
  for (const line of lines) {
    const m = line.match(cuitRegex);
    if (m) {
      detectedCuit = m[1];
      break;
    }
  }

  // 2. Extraer Nro de Comprobante / Factura
  let detectedInvoiceCode: string | undefined;
  const invCodeRegex = /(?:N[°ºo]\s*:?\s*|Factura\s*(?:[A-C])?\s*N[°ºo]?\s*:?\s*)(\d{4,5}[-\s]\d{8})/i;
  for (const line of lines) {
    const m = line.match(invCodeRegex);
    if (m) {
      detectedInvoiceCode = m[1].replace(/\s+/g, '-');
      break;
    }
  }

  // 3. Extraer Fecha de Emisión
  let detectedDate: string | undefined;
  const dateRegex = /(?:Fecha\s*:?\s*)(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i;
  for (const line of lines) {
    const m = line.match(dateRegex);
    if (m) {
      const parts = m[1].split(/[\/\-]/);
      if (parts.length === 3) {
        detectedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      break;
    }
  }

  // 4. Extraer Condición de Pago
  let paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'CUENTA_CORRIENTE' | 'CHEQUE' = 'EFECTIVO';
  const upperText = text.toUpperCase();
  if (upperText.includes('CUENTA CORRIENTE') || upperText.includes('CTA. CTE.')) {
    paymentMethod = 'CUENTA_CORRIENTE';
  } else if (upperText.includes('TRANSFERENCIA')) {
    paymentMethod = 'TRANSFERENCIA';
  } else if (upperText.includes('CHEQUE')) {
    paymentMethod = 'CHEQUE';
  }

  // 5. Extraer Totales
  let detectedTotal: number | undefined;
  let detectedSubtotal: number | undefined;
  const totalRegex = /(?:TOTAL\s*(?:A\s*PAGAR)?\s*:?[\s$]*)([\d\.\,]+)/i;
  const subtotalRegex = /(?:SUBTOTAL\s*:?[\s$]*)([\d\.\,]+)/i;

  for (const line of lines) {
    const tm = line.match(totalRegex);
    if (tm && !detectedTotal) {
      detectedTotal = parseLocaleNumber(tm[1]);
    }
    const sm = line.match(subtotalRegex);
    if (sm && !detectedSubtotal) {
      detectedSubtotal = parseLocaleNumber(sm[1]);
    }
  }

  // 6. Buscar Proveedor en la base de datos
  let matchedSupplier: { id: string; companyName: string; taxId: string | null } | null = null;
  if (detectedCuit) {
    const rawDigits = cleanCuit(detectedCuit);
    matchedSupplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { taxId: detectedCuit },
          { taxId: { contains: rawDigits } },
          { companyName: { contains: 'MERCURIO', mode: 'insensitive' } },
        ],
      },
      select: { id: true, companyName: true, taxId: true },
    });
  }

  if (!matchedSupplier) {
    if (upperText.includes('MERCURIO')) {
      matchedSupplier = await prisma.supplier.findFirst({
        where: { companyName: { contains: 'MERCURIO', mode: 'insensitive' } },
        select: { id: true, companyName: true, taxId: true },
      });
    }
  }

  // 7. Extraer Líneas de Artículos de la Factura
  const items: ParsedInvoiceItem[] = [];
  const seenCodes = new Set<string>();

  // Patrón Mercurio (en el flujo de texto de pdf-parse):
  // [Descripción] [UM] [Cantidad] [P. Unitario] [Código] [Desc] [Total]
  // Ej: COPA DOX251V PLASTICA P/MEZCLA PPG UN 2 3859,71 003503 0 7719,42
  // Ej: DILUYENTE POLIURETANICO PLUS X 18 UN 1 145800,00 011165 0 145800,00
  const mercurioRowRegex = /([A-Z0-9\/\.\-\+\s]{4,60}?)\s+(?:UN|L|KG|M|CJA|LT|MT|U)\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+(\d{4,8})\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)/gi;

  let mMatch: RegExpExecArray | null;
  while ((mMatch = mercurioRowRegex.exec(text)) !== null) {
    let desc = mMatch[1].trim();
    // Limpiar posibles fragmentos de teléfono o cabecera que anteceden al primer ítem
    desc = desc.replace(/^(?:TEL:?\s*)?\d{7,15}\s*/i, '').trim();
    const qty = parseInt(mMatch[2].replace(/[.,].*$/, ''), 10) || 1;
    const unitCost = parseLocaleNumber(mMatch[3]);
    const code = mMatch[4].trim();
    const lineTotal = parseLocaleNumber(mMatch[6]);

    // Filtrar falsos positivos y duplicados entre páginas (Original vs Duplicado)
    if (!seenCodes.has(code) && code !== '000000' && unitCost > 0) {
      seenCodes.add(code);
      items.push({
        supplierCode: code,
        description: desc,
        quantity: qty,
        unitCost,
        total: lineTotal,
        isMatched: false,
      });
    }
  }

  // Patrón Estándar Alternativo (Código al inicio de la línea):
  // Ej: 003503 COPA DOX251V PLASTICA P/MEZCLA PPG 2 3859,71 UN 0 7719,42
  if (items.length === 0) {
    const startCodeRowRegex = /^(\d{3,10}|[A-Z0-9\-_]{4,12})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([\d\.\,]+)\s*(?:UN|L|M|KG|CJA|U|MT|LT)?\s*(?:\d+(?:[.,]\d+)?)?\s*([\d\.\,]+)$/i;

    for (const line of lines) {
      if (
        line.startsWith('CAE:') ||
        line.startsWith('SUBTOTAL') ||
        line.startsWith('TOTAL') ||
        line.startsWith('GRAVADO') ||
        line.startsWith('IVA') ||
        line.startsWith('Código') ||
        line.startsWith('Domicilio')
      ) {
        continue;
      }

      const match = line.match(startCodeRowRegex);
      if (match) {
        const code = match[1].trim();
        const desc = match[2].trim();
        const qty = parseInt(match[3].replace(/[.,].*$/, ''), 10) || 1;
        const unitCost = parseLocaleNumber(match[4]);
        const lineTotal = parseLocaleNumber(match[5]);

        if (!seenCodes.has(code) && unitCost > 0) {
          seenCodes.add(code);
          items.push({
            supplierCode: code,
            description: desc,
            quantity: qty,
            unitCost,
            total: lineTotal,
            isMatched: false,
          });
        }
      }
    }
  }

  // 8. Buscar cada ítem en la base de datos de Productos por supplierCode
  for (const it of items) {
    const cleanCode = it.supplierCode.trim();
    const withoutLeadingZeros = cleanCode.replace(/^0+/, '');

    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { supplierCode: cleanCode },
          { supplierCode: withoutLeadingZeros },
          { supplierCode: { contains: cleanCode, mode: 'insensitive' } },
          { sku: cleanCode },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        supplierCode: true,
        currentStock: true,
        costPrice: true,
      },
    });

    if (product) {
      it.matchedProductId = product.id;
      it.matchedProductName = product.name;
      it.matchedProductSku = product.sku;
      it.isMatched = true;
    }
  }

  return {
    supplierId: matchedSupplier?.id,
    supplierName: matchedSupplier?.companyName,
    supplierTaxId: matchedSupplier?.taxId || detectedCuit,
    supplierFound: !!matchedSupplier,
    invoiceCode: detectedInvoiceCode,
    invoiceDate: detectedDate,
    paymentMethod,
    items,
    subtotal: detectedSubtotal,
    total: detectedTotal,
    rawTextPreview: lines.slice(0, 30).join('\n'),
  };
}
