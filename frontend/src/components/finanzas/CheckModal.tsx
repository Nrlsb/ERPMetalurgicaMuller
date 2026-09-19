'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export interface CheckItem {
  id: string;
  checkNumber: string;
  bank: string;
  type: 'FISICO' | 'ECHEQ';
  amount: number;
  issuer: string;
  issuerTaxId?: string | null;
  issueDate: string;
  paymentDate: string;
  status: 'CARTERA' | 'DEPOSITADO' | 'ENDOSADO' | 'RECHAZADO' | 'ANULADO';
  notes?: string | null;
  customerId?: string | null;
  customer?: { id: string; name: string; taxId?: string };
  bankAccountId?: string | null;
  bankAccount?: { id: string; bankName: string; accountNumber: string };
  cashRegisterId?: string | null;
  cashRegister?: { id: string; name: string };
  depositDate?: string | null;
  endorsedTo?: string | null;
  endorsementDate?: string | null;
  diffDays?: number;
  trafficLight?: 'GREEN' | 'YELLOW' | 'BLUE' | 'RED' | 'SETTLED';
  trafficLightLabel?: string;
}

interface CustomerOption {
  id: string;
  name: string;
  taxId?: string;
}

interface CheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  checkToEdit?: CheckItem | null;
}

const COMMON_BANKS = [
  'Banco Galicia',
  'Banco Santander',
  'Banco BBVA',
  'Banco Macro',
  'Banco de la Nación Argentina',
  'Banco Provincia de Buenos Aires',
  'Banco Ciudad',
  'Banco Credicoop',
  'Banco ICBC',
  'Banco HSBC',
  'Banco Patagonia',
  'Banco Supervielle',
  'Banco Comafi',
  'Banco Itaú',
  'Banco Hipotecario',
  'Banco de Córdoba (Bancor)',
  'Banco de Santa Fe',
  'Banco de Entre Ríos',
  'Banco de San Juan',
  'Banco del Chaco',
  'Banco Columbia',
  'Banco BIND',
];

export function CheckModal({ isOpen, onClose, onSuccess, checkToEdit }: CheckModalProps) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [form, setForm] = useState({
    checkNumber: '',
    bank: '',
    type: 'FISICO' as 'FISICO' | 'ECHEQ',
    amount: '',
    issuer: '',
    issuerTaxId: '',
    issueDate: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0],
    customerId: '',
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar clientes para autocompletar origen
  useEffect(() => {
    if (!isOpen) return;

    const loadCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const res = await fetchApi<any>('/sales/customers?limit=100');
        if (res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : res.data.items || [];
          setCustomers(list);
        }
      } catch (err) {
        console.error('Error cargando clientes:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    loadCustomers();
  }, [isOpen]);

  // Poblar formulario si se está editando
  useEffect(() => {
    if (checkToEdit) {
      setForm({
        checkNumber: checkToEdit.checkNumber || '',
        bank: checkToEdit.bank || '',
        type: checkToEdit.type || 'FISICO',
        amount: checkToEdit.amount ? checkToEdit.amount.toString() : '',
        issuer: checkToEdit.issuer || '',
        issuerTaxId: checkToEdit.issuerTaxId || '',
        issueDate: checkToEdit.issueDate
          ? new Date(checkToEdit.issueDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        paymentDate: checkToEdit.paymentDate
          ? new Date(checkToEdit.paymentDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        customerId: checkToEdit.customerId || '',
        notes: checkToEdit.notes || '',
      });
    } else {
      setForm({
        checkNumber: '',
        bank: '',
        type: 'FISICO',
        amount: '',
        issuer: '',
        issuerTaxId: '',
        issueDate: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0],
        customerId: '',
        notes: '',
      });
    }
    setError(null);
  }, [checkToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCustomerSelect = (customerId: string) => {
    setForm((prev) => {
      const selected = customers.find((c) => c.id === customerId);
      return {
        ...prev,
        customerId,
        // Si no tiene emisor escrito aún, autocompletar con el nombre del cliente
        issuer: prev.issuer ? prev.issuer : selected?.name || prev.issuer,
        issuerTaxId: prev.issuerTaxId ? prev.issuerTaxId : selected?.taxId || prev.issuerTaxId,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(form.amount);
    if (!form.checkNumber.trim()) {
      setError('El número de cheque es obligatorio');
      return;
    }
    if (!form.bank.trim()) {
      setError('El banco emisor es obligatorio');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!form.issuer.trim()) {
      setError('El nombre o razón social del emisor/librador es obligatorio');
      return;
    }
    if (!form.paymentDate) {
      setError('La fecha de cobro o vencimiento es obligatoria');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        checkNumber: form.checkNumber.trim(),
        bank: form.bank.trim(),
        type: form.type,
        amount: numAmount,
        issuer: form.issuer.trim(),
        issuerTaxId: form.issuerTaxId.trim() || undefined,
        issueDate: form.issueDate || undefined,
        paymentDate: form.paymentDate,
        customerId: form.customerId || undefined,
        notes: form.notes.trim() || undefined,
      };

      const endpoint = checkToEdit ? `/finance/checks/${checkToEdit.id}` : '/finance/checks';
      const method = checkToEdit ? 'PUT' : 'POST';

      const res = await fetchApi(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Error al procesar el cheque');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl relative animate-scaleIn my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {checkToEdit ? 'Editar Cheque' : 'Registrar Nuevo Cheque en Cartera'}
              </h3>
              <p className="text-xs text-slate-400">
                Módulo de Tesorería — Carga de cheques físicos y E-Cheqs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Cheque (Físico vs Echeq) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Cheque *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'FISICO' })}
                className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all ${
                  form.type === 'FISICO'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Cheque Físico / Papel</span>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'ECHEQ' })}
                className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all ${
                  form.type === 'ECHEQ'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-sm shadow-blue-500/20'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>E-Cheq (Electrónico)</span>
              </button>
            </div>
          </div>

          {/* Banco & Número de Cheque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Banco Emisor *
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="banks-list"
                  required
                  placeholder="Ej: Banco Galicia / Santander"
                  value={form.bank}
                  onChange={(e) => setForm({ ...form, bank: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <datalist id="banks-list">
                  {COMMON_BANKS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nº de Cheque *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: 00458921"
                value={form.checkNumber}
                onChange={(e) => setForm({ ...form, checkNumber: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Monto & Cliente Asociado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Monto en Pesos ($ ARS) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-emerald-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm font-bold font-mono text-emerald-400 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cliente Asociado (Opcional)
              </label>
              <select
                value={form.customerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">-- Sin cliente vinculado / Directo --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.taxId ? `(${c.taxId})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Emisor / Librador & CUIT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Librador / Emisor (Razón Social o Nombre) *
              </label>
              <input
                type="text"
                required
                placeholder="Nombre de quien firma el cheque"
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                CUIT / CUIL Emisor (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: 30-71234567-9"
                value={form.issuerTaxId}
                onChange={(e) => setForm({ ...form, issuerTaxId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Fechas: Emisión y Cobro/Vencimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Fecha de Emisión</span>
              </label>
              <input
                type="date"
                required
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Fecha de Cobro / Vencimiento *</span>
              </label>
              <input
                type="date"
                required
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:border-amber-400 focus:outline-none ring-1 ring-amber-500/20"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                A partir de esta fecha se activa el semáforo para depósito o cobro.
              </p>
            </div>
          </div>

          {/* Notas / Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones / Referencia
            </label>
            <input
              type="text"
              placeholder="Ej: Pago de Factura A-0004 o pedido especial"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Botones de acción */}
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
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{checkToEdit ? 'Guardar Cambios' : 'Registrar Cheque'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
