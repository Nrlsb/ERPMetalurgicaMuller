'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Landmark,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Unlock,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  Search,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

// ==========================================
// INTERFACES
// ==========================================

interface CashRegister {
  id: string;
  name: string;
  balance: number;
  isOpen: boolean;
  movements?: CashMovement[];
}

interface CashMovement {
  id: string;
  cashRegisterId: string;
  cashRegister?: { name: string };
  type: string;
  amount: number;
  concept: string;
  reference?: string;
  createdAt: string;
  user?: { fullName: string };
}

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
}

interface Expense {
  id: string;
  categoryId: string;
  category: { id: string; name: string };
  concept: string;
  amount: number;
  dueDate?: string;
  paymentDate?: string;
  isPaid: boolean;
  notes?: string;
  createdAt: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  cbu?: string;
  alias?: string;
  balance: number;
  transactions?: BankTransaction[];
}

interface BankTransaction {
  id: string;
  type: string;
  amount: number;
  concept: string;
  reference?: string;
  date: string;
}

export default function FinanzasPage() {
  const [activeTab, setActiveTab] = useState<'flow' | 'registers' | 'expenses' | 'banks'>('flow');

  // Data States
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Loading & Search
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  // Form: Nuevo Gasto
  const [expenseForm, setExpenseForm] = useState({
    categoryId: '',
    concept: '',
    amount: 0,
    dueDate: '',
    paymentDate: new Date().toISOString().split('T')[0],
    isPaid: true,
    payFromCashRegisterId: '',
    notes: '',
  });

  // Form: Movimiento Manual de Caja
  const [movementForm, setMovementForm] = useState({
    cashRegisterId: '',
    type: 'INGRESO_OTRO',
    amount: 0,
    concept: '',
    reference: '',
  });

  // Form: Cierre / Apertura de Caja
  const [registerActionForm, setRegisterActionForm] = useState({
    initialBalance: 0,
    countedBalance: 0,
    notes: '',
  });

  // Form: Nueva Cuenta Bancaria
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    accountType: 'Cuenta Corriente',
    cbu: '',
    alias: '',
    initialBalance: 0,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [regRes, movRes, expRes, catRes, bankRes] = await Promise.all([
        fetchApi<CashRegister[]>('/finance/cash-registers'),
        fetchApi<CashMovement[]>('/finance/cash-movements'),
        fetchApi<Expense[]>('/finance/expenses'),
        fetchApi<ExpenseCategory[]>('/finance/expenses/categories'),
        fetchApi<BankAccount[]>('/finance/bank-accounts'),
      ]);

      if (regRes.success && regRes.data) setCashRegisters(regRes.data);
      if (movRes.success && movRes.data) setCashMovements(movRes.data);
      if (expRes.success && expRes.data) setExpenses(expRes.data);
      if (catRes.success && catRes.data) setCategories(catRes.data);
      if (bankRes.success && bankRes.data) setBankAccounts(bankRes.data);
    } catch (e) {
      console.error('Error cargando finanzas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Submit Gasto
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (!expenseForm.categoryId || !expenseForm.concept.trim() || expenseForm.amount <= 0) {
        setFormError('Por favor, completa todos los campos requeridos con montos válidos');
        setIsSubmitting(false);
        return;
      }

      const res = await fetchApi('/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: expenseForm.categoryId,
          concept: expenseForm.concept.trim(),
          amount: Number(expenseForm.amount),
          dueDate: expenseForm.dueDate || undefined,
          paymentDate: expenseForm.isPaid ? expenseForm.paymentDate : undefined,
          isPaid: expenseForm.isPaid,
          payFromCashRegisterId: expenseForm.isPaid && expenseForm.payFromCashRegisterId ? expenseForm.payFromCashRegisterId : undefined,
          notes: expenseForm.notes.trim() || undefined,
        }),
      });

      if (res.success) {
        setIsExpenseModalOpen(false);
        setExpenseForm({
          categoryId: '',
          concept: '',
          amount: 0,
          dueDate: '',
          paymentDate: new Date().toISOString().split('T')[0],
          isPaid: true,
          payFromCashRegisterId: '',
          notes: '',
        });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al guardar el gasto');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Movimiento Manual de Caja
  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (!movementForm.cashRegisterId || movementForm.amount <= 0 || !movementForm.concept.trim()) {
        setFormError('Completa todos los datos del movimiento');
        setIsSubmitting(false);
        return;
      }

      const res = await fetchApi('/finance/cash-movements', {
        method: 'POST',
        body: JSON.stringify({
          cashRegisterId: movementForm.cashRegisterId,
          type: movementForm.type,
          amount: Number(movementForm.amount),
          concept: movementForm.concept.trim(),
          reference: movementForm.reference.trim() || undefined,
        }),
      });

      if (res.success) {
        setIsMovementModalOpen(false);
        setMovementForm({ cashRegisterId: '', type: 'INGRESO_OTRO', amount: 0, concept: '', reference: '' });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al registrar movimiento');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Apertura / Cierre de Caja
  const handleToggleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegister) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const endpoint = selectedRegister.isOpen
        ? `/finance/cash-registers/${selectedRegister.id}/close`
        : `/finance/cash-registers/${selectedRegister.id}/open`;

      const payload = selectedRegister.isOpen
        ? { countedBalance: Number(registerActionForm.countedBalance), notes: registerActionForm.notes }
        : { initialBalance: Number(registerActionForm.initialBalance) };

      const res = await fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setIsRegisterModalOpen(false);
        setSelectedRegister(null);
        setRegisterActionForm({ initialBalance: 0, countedBalance: 0, notes: '' });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al cambiar estado de la caja');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Cuenta Bancaria
  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetchApi('/finance/bank-accounts', {
        method: 'POST',
        body: JSON.stringify({
          bankName: bankForm.bankName.trim(),
          accountNumber: bankForm.accountNumber.trim(),
          accountType: bankForm.accountType,
          cbu: bankForm.cbu.trim() || undefined,
          alias: bankForm.alias.trim() || undefined,
          initialBalance: Number(bankForm.initialBalance) || 0,
        }),
      });

      if (res.success) {
        setIsBankModalOpen(false);
        setBankForm({ bankName: '', accountNumber: '', accountType: 'Cuenta Corriente', cbu: '', alias: '', initialBalance: 0 });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al crear cuenta bancaria');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cálculos de totales
  const totalCashInRegisters = cashRegisters.reduce((sum, r) => sum + Number(r.balance), 0);
  const totalBankBalance = bankAccounts.reduce((sum, b) => sum + Number(b.balance), 0);
  const totalLiquidFunds = totalCashInRegisters + totalBankBalance;
  const totalExpensesMonth = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const getMovementBadge = (type: string) => {
    if (type.startsWith('INGRESO') || type === 'APORTE') {
      return { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', sign: '+', icon: ArrowUpRight };
    }
    return { bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30', sign: '-', icon: ArrowDownRight };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-emerald-400" />
            <span>Tesorería, Cajas & Finanzas</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Módulo 5 — Cajas físicas, cuentas bancarias, ingresos, egresos y flujo de fondos consolidado
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setIsMovementModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs border border-slate-700 transition-all"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Movimiento de Caja</span>
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Receipt className="w-4 h-4" />
            <span>Registrar Gasto Operativo</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium uppercase">Cajas Físicas</p>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1">
            ${totalCashInRegisters.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">
            {cashRegisters.filter((r) => r.isOpen).length} cajas abiertas
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium uppercase">Cuentas Bancarias</p>
            <Landmark className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1">
            ${totalBankBalance.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{bankAccounts.length} cuentas registradas</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium uppercase">Total Líquido Disponible</p>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            ${totalLiquidFunds.toLocaleString('es-AR')} ARS
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Cajas + Saldos Bancarios</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium uppercase">Gastos Operativos</p>
            <Receipt className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-400 mt-1">
            ${totalExpensesMonth.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{expenses.length} gastos registrados</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('flow')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'flow'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Flujo de Caja (Movimientos)</span>
        </button>

        <button
          onClick={() => setActiveTab('registers')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'registers'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Cajas Mostrador ({cashRegisters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'expenses'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Gastos Operativos ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('banks')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'banks'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Cuentas Bancarias ({bankAccounts.length})</span>
        </button>
      </div>

      {/* ================= TAB 1: FLUJO DE CAJA ================= */}
      {activeTab === 'flow' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Concepto</th>
                    <th className="py-3 px-4 font-semibold">Caja / Origen</th>
                    <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
                    <th className="py-3 px-4 font-semibold">Responsable</th>
                    <th className="py-3 px-4 font-semibold text-right">Monto</th>
                    <th className="py-3 px-4 font-semibold text-center">Tipo Movimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cashMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No hay movimientos de fondos registrados aún.
                      </td>
                    </tr>
                  ) : (
                    cashMovements.map((mov) => {
                      const badge = getMovementBadge(mov.type);
                      const Icon = badge.icon;

                      return (
                        <tr key={mov.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-white">
                            {mov.concept}
                            {mov.reference && <span className="block text-[10px] text-slate-500">Ref: {mov.reference}</span>}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">{mov.cashRegister?.name || 'Caja Central'}</td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {new Date(mov.createdAt).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">{mov.user?.fullName || 'Sistema'}</td>
                          <td
                            className={`py-3.5 px-4 text-right font-bold font-mono text-sm ${
                              badge.sign === '+' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {badge.sign}${Number(mov.amount).toLocaleString('es-AR')}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{mov.type.replace('_', ' ')}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CAJAS ================= */}
      {activeTab === 'registers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cashRegisters.map((reg) => (
            <div key={reg.id} className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700 text-emerald-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{reg.name}</h3>
                    <p className="text-xs text-slate-400">Punto de Cobro y Efectivo</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    reg.isOpen
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {reg.isOpen ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>{reg.isOpen ? 'Abierta' : 'Cerrada'}</span>
                </span>
              </div>

              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-400 uppercase">Saldo en Caja:</span>
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                  ${Number(reg.balance).toLocaleString('es-AR')} ARS
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedRegister(reg);
                    setRegisterActionForm({
                      initialBalance: 0,
                      countedBalance: Number(reg.balance),
                      notes: '',
                    });
                    setIsRegisterModalOpen(true);
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 ${
                    reg.isOpen
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {reg.isOpen ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Cerrar Turno & Arqueo</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Abrir Turno de Caja</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= TAB 3: GASTOS ================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Concepto del Gasto</th>
                    <th className="py-3 px-4 font-semibold">Categoría</th>
                    <th className="py-3 px-4 font-semibold">Fecha de Pago</th>
                    <th className="py-3 px-4 font-semibold text-right">Monto</th>
                    <th className="py-3 px-4 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No hay gastos operativos registrados. Presiona "Registrar Gasto Operativo".
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {exp.concept}
                          {exp.notes && <span className="block text-[10px] text-slate-500">{exp.notes}</span>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px]">
                            {exp.category?.name || 'General'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {exp.paymentDate ? new Date(exp.paymentDate).toLocaleDateString('es-AR') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-rose-400 font-mono">
                          ${Number(exp.amount).toLocaleString('es-AR')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              exp.isPaid
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {exp.isPaid ? 'Abonado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: BANCOS ================= */}
      {activeTab === 'banks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsBankModalOpen(true)}
              className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-3 rounded-xl text-xs border border-slate-700"
            >
              <Plus className="w-4 h-4 text-blue-400" />
              <span>Añadir Cuenta Bancaria</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bankAccounts.length === 0 ? (
              <div className="col-span-2 glass-panel p-8 text-center text-slate-500 rounded-3xl border border-slate-800">
                No hay cuentas bancarias registradas. Presiona "Añadir Cuenta Bancaria".
              </div>
            ) : (
              bankAccounts.map((b) => (
                <div key={b.id} className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{b.bankName}</h3>
                        <p className="text-xs text-slate-400">{b.accountType} • Nro: {b.accountNumber}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Saldo Disponible:</span>
                    <span className="text-2xl font-extrabold text-blue-400 font-mono">
                      ${Number(b.balance).toLocaleString('es-AR')} ARS
                    </span>
                  </div>

                  {(b.cbu || b.alias) && (
                    <div className="text-xs text-slate-400 space-y-0.5">
                      {b.cbu && <p>CBU: <span className="font-mono text-slate-300">{b.cbu}</span></p>}
                      {b.alias && <p>Alias: <span className="font-mono text-slate-300">{b.alias}</span></p>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: REGISTRAR GASTO ================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-rose-400" />
                  <span>Registrar Gasto Operativo</span>
                </h3>
                <p className="text-xs text-slate-400">Alquileres, sueldos, servicios, impuestos o insumos</p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría del Gasto *</label>
                <select
                  required
                  value={expenseForm.categoryId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Selecciona categoría...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Concepto / Descripción *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de Luz y Energía Eléctrica - Sucursal Central"
                  value={expenseForm.concept}
                  onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={expenseForm.paymentDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Opción deducir de caja */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deducir de Caja Mostrador</label>
                <select
                  value={expenseForm.payFromCashRegisterId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, payFromCashRegisterId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">No deducir (o pago por banco/transferencia externa)</option>
                  {cashRegisters
                    .filter((r) => r.isOpen)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Saldo actual: ${Number(r.balance).toLocaleString('es-AR')})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20"
                >
                  {isSubmitting ? 'Guardando...' : 'Registrar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: MOVIMIENTO DE CAJA ================= */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Movimiento Manual de Fondos</span>
                </h3>
                <p className="text-xs text-slate-400">Ingresos varios, retiros o aportes de capital</p>
              </div>
              <button
                onClick={() => setIsMovementModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Caja Destino / Origen *</label>
                <select
                  required
                  value={movementForm.cashRegisterId}
                  onChange={(e) => setMovementForm({ ...movementForm, cashRegisterId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Seleccionar caja...</option>
                  {cashRegisters
                    .filter((r) => r.isOpen)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Saldo: ${Number(r.balance).toLocaleString('es-AR')})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Movimiento</label>
                <select
                  value={movementForm.type}
                  onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="INGRESO_OTRO">Ingreso Extra (+)</option>
                  <option value="APORTE">Aporte de Capital (+)</option>
                  <option value="RETIRO">Retiro de Efectivo (-)</option>
                  <option value="EGRESO_GASTO">Egreso Vario (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Monto ($) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={movementForm.amount}
                  onChange={(e) => setMovementForm({ ...movementForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Concepto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Retiro para cambio o Ingreso extraordinario"
                  value={movementForm.concept}
                  onChange={(e) => setMovementForm({ ...movementForm, concept: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? 'Guardando...' : 'Confirmar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: APERTURA / CIERRE DE CAJA ================= */}
      {isRegisterModalOpen && selectedRegister && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-lg text-white">
                  {selectedRegister.isOpen ? 'Cierre de Turno & Arqueo' : 'Apertura de Turno'}
                </h3>
                <p className="text-xs text-slate-400">{selectedRegister.name}</p>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleToggleRegister} className="space-y-4">
              {selectedRegister.isOpen ? (
                <>
                  <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Saldo según Sistema:</span>
                      <span className="font-bold text-white font-mono">
                        ${Number(selectedRegister.balance).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Efectivo Recontado en Caja ($) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={registerActionForm.countedBalance}
                      onChange={(e) =>
                        setRegisterActionForm({ ...registerActionForm, countedBalance: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Observaciones / Notas</label>
                    <input
                      type="text"
                      placeholder="Ej: Cierre conforme sin diferencias"
                      value={registerActionForm.notes}
                      onChange={(e) => setRegisterActionForm({ ...registerActionForm, notes: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fondo Inicial de Caja ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={registerActionForm.initialBalance}
                    onChange={(e) =>
                      setRegisterActionForm({ ...registerActionForm, initialBalance: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl ${
                    selectedRegister.isOpen ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
                  }`}
                >
                  {isSubmitting ? 'Procesando...' : selectedRegister.isOpen ? 'Confirmar Cierre' : 'Abrir Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: NUEVA CUENTA BANCARIA ================= */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-blue-400" />
                  <span>Añadir Cuenta Bancaria</span>
                </h3>
              </div>
              <button
                onClick={() => setIsBankModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateBank} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Banco *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Banco Galicia / Santander"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Número de Cuenta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 4001234-5 001-2"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">CBU</label>
                  <input
                    type="text"
                    placeholder="0070001234567890123456"
                    value={bankForm.cbu}
                    onChange={(e) => setBankForm({ ...bankForm, cbu: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Alias</label>
                  <input
                    type="text"
                    placeholder="EMPRESA.MULLER.PAGO"
                    value={bankForm.alias}
                    onChange={(e) => setBankForm({ ...bankForm, alias: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
