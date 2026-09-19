'use client';

import React, { useState } from 'react';
import {
  X,
  Landmark,
  Wallet,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { CheckItem } from './CheckModal';

interface BankAccountOption {
  id: string;
  bankName: string;
  accountNumber: string;
}

interface CashRegisterOption {
  id: string;
  name: string;
  isOpen: boolean;
}

interface CheckActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  check: CheckItem | null;
  actionType: 'DEPOSIT' | 'ENDORSE' | 'REJECT';
  bankAccounts: BankAccountOption[];
  cashRegisters: CashRegisterOption[];
}

export function CheckActionModal({
  isOpen,
  onClose,
  onSuccess,
  check,
  actionType,
  bankAccounts,
  cashRegisters,
}: CheckActionModalProps) {
  const [destinationType, setDestinationType] = useState<'BANK' | 'CASH' | 'EXTERNAL'>('BANK');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [endorsedTo, setEndorsedTo] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !check) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let payload: any = {};

    if (actionType === 'DEPOSIT') {
      payload.status = 'DEPOSITADO';
      payload.depositDate = date;

      if (destinationType === 'BANK') {
        if (!selectedBankId) {
          setError('Selecciona la cuenta bancaria de destino');
          return;
        }
        payload.bankAccountId = selectedBankId;
      } else if (destinationType === 'CASH') {
        if (!selectedCashRegisterId) {
          setError('Selecciona la caja de destino');
          return;
        }
        payload.cashRegisterId = selectedCashRegisterId;
      }
      if (notes.trim()) payload.notes = notes.trim();
    } else if (actionType === 'ENDORSE') {
      if (!endorsedTo.trim()) {
        setError('Debes indicar el nombre del tercero o proveedor al que se endosa el cheque');
        return;
      }
      payload.status = 'ENDOSADO';
      payload.endorsedTo = endorsedTo.trim();
      payload.endorsementDate = date;
      if (notes.trim()) payload.notes = notes.trim();
    } else if (actionType === 'REJECT') {
      payload.status = 'RECHAZADO';
      payload.notes = notes.trim() ? `Motivo rechazo: ${notes.trim()}` : 'Rechazado por el banco';
    }

    setIsSubmitting(true);
    try {
      const res = await fetchApi(`/finance/checks/${check.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Error al actualizar el estado del cheque');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-scaleIn">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                actionType === 'DEPOSIT'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : actionType === 'ENDORSE'
                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {actionType === 'DEPOSIT' ? (
                <Landmark className="w-5 h-5" />
              ) : actionType === 'ENDORSE' ? (
                <ArrowRightLeft className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {actionType === 'DEPOSIT'
                  ? 'Cobrar / Depositar Cheque'
                  : actionType === 'ENDORSE'
                  ? 'Endosar / Entregar Cheque'
                  : 'Marcar Cheque Rechazado'}
              </h3>
              <p className="text-xs text-slate-400">
                Cheque #{check.checkNumber} — {check.bank}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen del cheque */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">Librador: <span className="text-white font-medium">{check.issuer}</span></div>
            <div className="text-[11px] text-slate-400">Fecha de Cobro: <span className="text-amber-400 font-semibold">{new Date(check.paymentDate).toLocaleDateString('es-AR')}</span></div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Importe</div>
            <div className="text-base font-bold font-mono text-emerald-400">
              ${Number(check.amount).toLocaleString('es-AR')}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ACCIÓN: DEPOSITAR / COBRAR */}
          {actionType === 'DEPOSIT' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Destino de los Fondos
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setDestinationType('BANK')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      destinationType === 'BANK'
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Landmark className="w-4 h-4" />
                    <span>Cuenta Bancaria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestinationType('CASH')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      destinationType === 'CASH'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Caja en Efectivo</span>
                  </button>
                </div>
              </div>

              {destinationType === 'BANK' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cuenta Bancaria Receptora *
                  </label>
                  {bankAccounts.length === 0 ? (
                    <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl">
                      No hay cuentas bancarias registradas. Puedes registrar una en la pestaña Cuentas Bancarias o elegir Cobro en Caja.
                    </p>
                  ) : (
                    <select
                      required
                      value={selectedBankId}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Seleccionar cuenta bancaria --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - Cta: {b.accountNumber}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se acreditará automáticamente el saldo en la cuenta bancaria y quedará registrado el movimiento.
                  </p>
                </div>
              )}

              {destinationType === 'CASH' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Caja Mostrador / Central *
                  </label>
                  <select
                    required
                    value={selectedCashRegisterId}
                    onChange={(e) => setSelectedCashRegisterId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar caja --</option>
                    {cashRegisters.map((c) => (
                      <option key={c.id} value={c.id} disabled={!c.isOpen}>
                        {c.name} {c.isOpen ? '(Abierta)' : '(Cerrada)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se registrará un ingreso de fondos en la caja seleccionada.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Fecha de Acreditación / Depósito</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* ACCIÓN: ENDOSAR */}
          {actionType === 'ENDORSE' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Endosado / Entregado a (Proveedor o Tercero) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Aceros Del Plata S.A. / Proveedor Juan"
                  value={endorsedTo}
                  onChange={(e) => setEndorsedTo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Fecha de Entrega / Endoso</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* ACCIÓN: RECHAZAR */}
          {actionType === 'REJECT' && (
            <div>
              <label className="block text-xs font-semibold text-rose-300 mb-1">
                Motivo del Rechazo Bancario *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ej: Rechazado por el banco emisor: Sin fondos suficientes / Firma disconforme"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-rose-500/40 rounded-xl p-3 text-xs text-white focus:border-rose-400 focus:outline-none"
              />
            </div>
          )}

          {/* Observaciones generales para depósito o endoso */}
          {actionType !== 'REJECT' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Notas / Referencia adicional
              </label>
              <input
                type="text"
                placeholder="Opcional: nro de comprobante o referencia"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-lg transition-all flex items-center gap-1.5 ${
                actionType === 'DEPOSIT'
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                  : actionType === 'ENDORSE'
                  ? 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/20'
                  : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
              }`}
            >
              {isSubmitting ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {actionType === 'DEPOSIT'
                      ? 'Confirmar Cobro'
                      : actionType === 'ENDORSE'
                      ? 'Confirmar Endoso'
                      : 'Confirmar Rechazo'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
