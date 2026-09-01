'use client';

import React, { useState } from 'react';
import { DollarSign, Clock, CheckCircle2, AlertCircle, Search, X } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

export interface Receivable {
  id: string;
  customer: { id: string; name: string; phone?: string; email?: string; taxId?: string };
  invoice: { id: string; code: string; issueDate: string; total: number; paymentMethod: string };
  totalAmount: number;
  balance: number;
  dueDate: string;
  isSettled: boolean;
  payments?: {
    id: string;
    amount: number;
    method: string;
    reference?: string;
    paymentDate: string;
  }[];
}

interface ReceivablesViewProps {
  receivables: Receivable[];
  onPaymentSuccess: () => void;
}

export function ReceivablesView({ receivables, onPaymentSuccess }: ReceivablesViewProps) {
  const { success, error } = useToast();
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'EFECTIVO',
    reference: '',
    notes: '',
  });

  const openPaymentModal = (rec: Receivable) => {
    setSelectedReceivable(rec);
    setPaymentForm({
      amount: Number(rec.balance),
      method: 'EFECTIVO',
      reference: '',
      notes: '',
    });
    setIsPaymentModalOpen(true);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;

    if (paymentForm.amount <= 0 || paymentForm.amount > Number(selectedReceivable.balance)) {
      error(`Monto inválido. Debe ser entre $1 y $${Number(selectedReceivable.balance).toLocaleString('es-AR')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetchApi('/sales/payments', {
        method: 'POST',
        body: JSON.stringify({
          receivableId: selectedReceivable.id,
          ...paymentForm,
        }),
      });

      if (res.success) {
        success(`Cobro de $${paymentForm.amount.toLocaleString('es-AR')} registrado con éxito`);
        setIsPaymentModalOpen(false);
        onPaymentSuccess();
      } else {
        error(res.message || 'Error al registrar la cobranza');
      }
    } catch (e: any) {
      error('Error de red al procesar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPendingBalance = receivables
    .filter((r) => !r.isSettled)
    .reduce((acc, r) => acc + Number(r.balance), 0);

  return (
    <div className="space-y-4">
      {/* Tarjeta de saldo total a cobrar */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Total en Cuentas Corrientes</div>
            <div className="text-2xl font-black text-white">${totalPendingBalance.toLocaleString('es-AR')}</div>
          </div>
        </div>
        <span className="text-xs text-slate-400">
          {receivables.filter((r) => !r.isSettled).length} comprobantes pendientes de cobro
        </span>
      </div>

      {/* Tabla de Cuentas por Cobrar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Factura / Ref</th>
                <th className="p-4">Vencimiento</th>
                <th className="p-4 text-right">Total Factura</th>
                <th className="p-4 text-right">Saldo Pendiente</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No hay cuentas por cobrar registradas
                  </td>
                </tr>
              ) : (
                receivables.map((rec) => {
                  const isOverdue = !rec.isSettled && new Date(rec.dueDate) < new Date();
                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white">{rec.customer.name}</div>
                        <div className="text-xs text-slate-400">CUIT: {rec.customer.taxId || 'Cons. Final'}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-blue-400">
                          {rec.invoice.code}
                        </span>
                      </td>
                      <td className="p-4 text-xs">
                        <div className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {new Date(rec.dueDate).toLocaleDateString('es-AR')}
                        </div>
                        {isOverdue && <div className="text-[10px] text-rose-500 font-semibold">Vencida</div>}
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-300">
                        ${Number(rec.totalAmount).toLocaleString('es-AR')}
                      </td>
                      <td className="p-4 text-right font-black text-amber-400">
                        ${Number(rec.balance).toLocaleString('es-AR')}
                      </td>
                      <td className="p-4 text-center">
                        {rec.isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Saldada
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isOverdue
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!rec.isSettled && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(rec)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20"
                          >
                            Registrar Cobro
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cobro */}
      {isPaymentModalOpen && selectedReceivable && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Registrar Cobro</h3>
                  <p className="text-xs text-slate-400">Factura {selectedReceivable.invoice.code}</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="p-6 space-y-4">
              <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Cliente:</span>
                  <span className="font-bold text-white">{selectedReceivable.customer.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Saldo adeudado:</span>
                  <span className="font-black text-amber-400">
                    ${Number(selectedReceivable.balance).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Monto a Cobrar ($) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={Number(selectedReceivable.balance)}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Medio de Pago
                </label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="EFECTIVO">Efectivo (Ingresa a Caja Mostrador)</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  <option value="CHEQUE">Cheque al Día / Diferido</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Referencia / Nro Comprobante
                </label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="Ej. Transf. Nro 994829"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
