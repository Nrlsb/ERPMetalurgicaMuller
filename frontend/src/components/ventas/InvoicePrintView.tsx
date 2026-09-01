'use client';

import React from 'react';
import { Printer, X, Download } from 'lucide-react';
import { printDocument } from '@/lib/export';

interface InvoicePrintViewProps {
  invoice: {
    code: string;
    type: string;
    issueDate: string;
    dueDate?: string;
    customer: {
      name: string;
      code?: string;
      taxId?: string;
      taxType?: string;
      address?: string;
      phone?: string;
      email?: string;
    };
    paymentMethod: string;
    subtotal: number;
    discount: number;
    taxAmount: number;
    total: number;
    paidAmount?: number;
    notes?: string;
    items?: {
      product?: { sku: string; name: string };
      quantity: number;
      unitPrice: number;
      discount?: number;
      subtotal: number;
    }[];
  };
  onClose: () => void;
}

export function InvoicePrintView({ invoice, onClose }: InvoicePrintViewProps) {
  const handlePrint = () => {
    printDocument('printable-invoice-content', `Comprobante_${invoice.code}`);
  };

  const isQuote = invoice.code.startsWith('COT-');
  const docTitle = isQuote ? 'PRESUPUESTO / COTIZACIÓN' : `COMPROBANTE ${invoice.type.replace('_', ' ')}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header de la ventana */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Vista Previa de Comprobante</h2>
              <p className="text-xs text-slate-400">Código: {invoice.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenedor del documento (Blanco/Estilo Hoja A4) */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50 flex justify-center">
          <div
            id="printable-invoice-content"
            className="w-full max-w-3xl bg-white text-slate-900 p-8 rounded-xl shadow-md font-sans text-sm"
          >
            {/* Encabezado */}
            <div className="header-box flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-blue-900">ERP MULLER JUAN</h1>
                <p className="text-xs text-slate-600 mt-1">Venta y Distribución de Insumos y Productos</p>
                <p className="text-xs text-slate-500">Tel: +54 (11) 4000-0000 | Email: contacto@erpmuller.com</p>
                <p className="text-xs text-slate-500">Buenos Aires, Argentina</p>
              </div>
              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded font-bold text-xs mb-1">
                  {docTitle}
                </div>
                <div className="text-lg font-bold text-slate-900">{invoice.code}</div>
                <div className="text-xs text-slate-600">
                  Fecha: {new Date(invoice.issueDate).toLocaleDateString('es-AR')}
                </div>
                {invoice.dueDate && (
                  <div className="text-xs text-slate-500">
                    Vto: {new Date(invoice.dueDate).toLocaleDateString('es-AR')}
                  </div>
                )}
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Datos del Cliente
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-700">Razón Social:</span>{' '}
                  <span className="text-slate-900 font-bold">{invoice.customer.name}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">CUIT / DNI:</span>{' '}
                  <span className="text-slate-900">{invoice.customer.taxId || 'Consumidor Final'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Condición IVA:</span>{' '}
                  <span className="text-slate-900">{invoice.customer.taxType || 'Consumidor Final'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Forma de Pago:</span>{' '}
                  <span className="text-slate-900 font-semibold">{invoice.paymentMethod}</span>
                </div>
                {invoice.customer.address && (
                  <div className="col-span-2">
                    <span className="font-semibold text-slate-700">Dirección:</span>{' '}
                    <span className="text-slate-900">{invoice.customer.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de Productos / Ítems */}
            <table className="w-full border-collapse my-4 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                  <th className="p-2.5 text-left font-semibold">SKU</th>
                  <th className="p-2.5 text-left font-semibold">Descripción del Producto</th>
                  <th className="p-2.5 text-center font-semibold">Cant.</th>
                  <th className="p-2.5 text-right font-semibold">P. Unitario</th>
                  {invoice.items?.some((i) => (i.discount || 0) > 0) && (
                    <th className="p-2.5 text-right font-semibold">Desc. %</th>
                  )}
                  <th className="p-2.5 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-slate-600">{item.product?.sku || '-'}</td>
                      <td className="p-2.5 text-slate-800 font-medium">{item.product?.name || 'Ítem'}</td>
                      <td className="p-2.5 text-center text-slate-700 font-semibold">{item.quantity}</td>
                      <td className="p-2.5 text-right text-slate-700">
                        ${Number(item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      {invoice.items?.some((i) => (i.discount || 0) > 0) && (
                        <td className="p-2.5 text-right text-slate-600">
                          {item.discount ? `${item.discount}%` : '-'}
                        </td>
                      )}
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        ${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      Sin ítems cargados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totales y Observaciones */}
            <div className="flex justify-between items-start mt-6 pt-4 border-t border-slate-200">
              <div className="max-w-md text-xs text-slate-600">
                {invoice.notes && (
                  <div>
                    <span className="font-bold text-slate-700">Observaciones:</span>
                    <p className="mt-1 italic">{invoice.notes}</p>
                  </div>
                )}
                <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500">
                  <p>Comprobante generado por el sistema ERP Müller Juan.</p>
                  <p>Documento no válido como factura fiscal electrónica AFIP sin CAE.</p>
                </div>
              </div>

              <div className="w-64 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Subtotal Bruto:</span>
                  <span className="font-semibold">
                    ${Number(invoice.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between py-1 text-emerald-700 font-medium">
                    <span>Descuento General:</span>
                    <span>-${Number(invoice.discount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>IVA / Impuestos:</span>
                    <span className="font-semibold">
                      ${Number(invoice.taxAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 mt-2 border-t-2 border-slate-300 text-base font-black text-slate-900">
                  <span>TOTAL:</span>
                  <span>${Number(invoice.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Pie de página */}
            <div className="footer-box mt-10 pt-4 border-t border-slate-200 text-center text-[11px] text-slate-400">
              Gracias por su confianza. Muller Juan - ERP Integral.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
