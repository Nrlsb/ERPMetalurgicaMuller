'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  User,
  CreditCard,
  Percent,
  Receipt,
  Loader2,
  ArrowDownRight,
  TrendingUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface CustomerInvoiceItem {
  id: string;
  productId: string;
  product: { id: string; sku: string; name: string };
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface CustomerInvoice {
  id: string;
  code: string;
  type: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paidAmount: number;
  isPaid: boolean;
  paymentMethod: string;
  notes?: string;
  items?: CustomerInvoiceItem[];
}

interface CustomerDetails {
  id: string;
  code: string;
  name: string;
  taxId?: string;
  taxType?: string;
  currentBalance: number;
  creditLimit: number;
  invoices: CustomerInvoice[];
}

interface CustomerMovementsModalProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerMovementsModal: React.FC<CustomerMovementsModalProps> = ({
  customerId,
  isOpen,
  onClose,
}) => {
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !customerId) return;

    const loadCustomerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchApi(`/sales/customers/${customerId}`);
        if (res.success && res.data) {
          setCustomer(res.data);
        } else {
          setError(res.message || 'No se pudo cargar la información del cliente');
        }
      } catch (err: any) {
        setError(err.message || 'Error de conexión al cargar datos del cliente');
      } finally {
        setLoading(false);
      }
    };

    loadCustomerData();
  }, [isOpen, customerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Movimientos & Facturación de Cliente
                </h3>
                {customer?.code && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {customer.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {customer?.name} — {customer?.taxId || 'Consumidor Final'} ({customer?.taxType || 'Sin asignar'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-slate-400">Cargando cuenta corriente y comprobantes...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : customer ? (
            <>
              {/* KPIs de Saldo del Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Saldo Deudor Actual</div>
                  <div className="text-xl font-black text-amber-400 mt-1 font-mono">
                    ${Number(customer.currentBalance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Límite de Crédito</div>
                  <div className="text-xl font-black text-slate-200 mt-1 font-mono">
                    ${Number(customer.creditLimit).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Total Facturas Emitidas</div>
                  <div className="text-xl font-black text-blue-400 mt-1 font-mono">
                    {customer.invoices.length} comprobantes
                  </div>
                </div>
              </div>

              {/* Tabla de Movimientos / Facturación con las columnas especificadas */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 px-1">
                  Historial de Movimientos de Facturación
                </div>

                {customer.invoices.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-800/30 border border-slate-800 text-slate-400 text-xs">
                    Este cliente aún no registra facturas ni movimientos de venta.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 uppercase font-bold border-b border-slate-700">
                          <tr>
                            <th className="py-3 px-3.5">Movimiento</th>
                            <th className="py-3 px-3.5">Fecha</th>
                            <th className="py-3 px-3.5">Fecha Vto.</th>
                            <th className="py-3 px-3.5">Productos</th>
                            <th className="py-3 px-3.5 text-center">Cantidad</th>
                            <th className="py-3 px-3.5">Método de Pago</th>
                            <th className="py-3 px-3.5 text-right">Descuento</th>
                            <th className="py-3 px-3.5 text-right">Total</th>
                            <th className="py-3 px-3.5 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {customer.invoices.map((inv) => {
                            const totalUnits =
                              inv.items?.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || 0;
                            const isOverdue =
                              !inv.isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();

                            return (
                              <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                                {/* Movimiento */}
                                <td className="py-3.5 px-3.5">
                                  <div className="font-mono font-bold text-blue-400">{inv.code}</div>
                                  <div className="text-[10px] text-slate-400 font-semibold">
                                    {inv.type.replace('_', ' ')}
                                  </div>
                                </td>

                                {/* Fecha */}
                                <td className="py-3.5 px-3.5 text-slate-300 font-medium whitespace-nowrap">
                                  {new Date(inv.issueDate).toLocaleDateString('es-AR')}
                                </td>

                                {/* Fecha de Vto */}
                                <td className="py-3.5 px-3.5 whitespace-nowrap">
                                  {inv.dueDate ? (
                                    <span
                                      className={`inline-flex items-center gap-1 font-semibold ${
                                        isOverdue ? 'text-rose-400' : 'text-slate-300'
                                      }`}
                                    >
                                      {isOverdue && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />}
                                      {new Date(inv.dueDate).toLocaleDateString('es-AR')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">—</span>
                                  )}
                                </td>

                                {/* Productos */}
                                <td className="py-3.5 px-3.5">
                                  {inv.items && inv.items.length > 0 ? (
                                    <div className="max-w-[220px] space-y-1">
                                      {inv.items.slice(0, 2).map((it) => (
                                        <div key={it.id} className="truncate text-slate-300 text-[11px]" title={it.product.name}>
                                          • {it.product.name}{' '}
                                          <span className="text-slate-400 font-mono">({it.quantity}u)</span>
                                        </div>
                                      ))}
                                      {inv.items.length > 2 && (
                                        <div className="text-[10px] text-sky-400 font-semibold">
                                          +{inv.items.length - 2} productos más...
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500">Sin detalle</span>
                                  )}
                                </td>

                                {/* Cantidad */}
                                <td className="py-3.5 px-3.5 text-center font-bold text-slate-200 font-mono">
                                  {totalUnits}
                                </td>

                                {/* Método de Pago */}
                                <td className="py-3.5 px-3.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-[11px]">
                                    {inv.paymentMethod}
                                  </span>
                                </td>

                                {/* Descuento */}
                                <td className="py-3.5 px-3.5 text-right font-mono text-slate-400">
                                  {Number(inv.discount) > 0 ? (
                                    <span className="text-amber-400 font-bold">
                                      -${Number(inv.discount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>

                                {/* Total */}
                                <td className="py-3.5 px-3.5 text-right font-black text-white font-mono">
                                  ${Number(inv.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>

                                {/* Estado */}
                                <td className="py-3.5 px-3.5 text-center">
                                  {inv.isPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <CheckCircle2 className="w-3 h-3" /> Pagada
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      <Clock className="w-3 h-3" /> Pendiente
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
