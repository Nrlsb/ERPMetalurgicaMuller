'use client';

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Landmark,
  FileText,
  Calendar,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
  Filter,
  DollarSign,
  AlertCircle,
  MoreVertical,
  Check,
} from 'lucide-react';
import { CheckItem, CheckModal } from './CheckModal';
import { CheckActionModal } from './CheckActionModal';
import { fetchApi } from '@/lib/api';

interface ChecksManagementViewProps {
  checks: CheckItem[];
  bankAccounts: { id: string; bankName: string; accountNumber: string }[];
  cashRegisters: { id: string; name: string; isOpen: boolean }[];
  onRefresh: () => void;
  onOpenCreateModal: () => void;
}

type FilterTab = 'ALL' | 'CARTERA' | 'READY' | 'UPCOMING' | 'DEFERRED' | 'DEPOSITADO' | 'ENDOSADO' | 'EXPIRED';

export function ChecksManagementView({
  checks,
  bankAccounts,
  cashRegisters,
  onRefresh,
  onOpenCreateModal,
}: ChecksManagementViewProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FISICO' | 'ECHEQ'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales de acciones
  const [editingCheck, setEditingCheck] = useState<CheckItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedActionCheck, setSelectedActionCheck] = useState<CheckItem | null>(null);
  const [actionType, setActionType] = useState<'DEPOSIT' | 'ENDORSE' | 'REJECT'>('DEPOSIT');

  const [deletingCheckId, setDeletingCheckId] = useState<string | null>(null);

  // Métricas del Semáforo
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const metrics = useMemo(() => {
    let totalCarteraAmount = 0;
    let totalCarteraCount = 0;

    let readyAmount = 0;
    let readyCount = 0;

    let upcomingAmount = 0;
    let upcomingCount = 0;

    let deferredAmount = 0;
    let deferredCount = 0;

    let expiredAmount = 0;
    let expiredCount = 0;

    checks.forEach((c) => {
      const pDate = new Date(c.paymentDate);
      const checkDateOnly = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
      const diffMs = checkDateOnly.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (c.status === 'CARTERA') {
        totalCarteraCount++;
        totalCarteraAmount += Number(c.amount);

        if (diffDays <= 0 && diffDays >= -30) {
          readyCount++;
          readyAmount += Number(c.amount);
        } else if (diffDays >= 1 && diffDays <= 7) {
          upcomingCount++;
          upcomingAmount += Number(c.amount);
        } else if (diffDays > 7) {
          deferredCount++;
          deferredAmount += Number(c.amount);
        } else {
          // Más de 30 días de antigüedad
          expiredCount++;
          expiredAmount += Number(c.amount);
        }
      }
    });

    return {
      totalCarteraAmount,
      totalCarteraCount,
      readyAmount,
      readyCount,
      upcomingAmount,
      upcomingCount,
      deferredAmount,
      deferredCount,
      expiredAmount,
      expiredCount,
    };
  }, [checks, today]);

  // Filtrado de la lista
  const filteredChecks = useMemo(() => {
    return checks.filter((c) => {
      const pDate = new Date(c.paymentDate);
      const checkDateOnly = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
      const diffMs = checkDateOnly.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Filtro por pestaña
      if (activeFilter === 'CARTERA' && c.status !== 'CARTERA') return false;
      if (activeFilter === 'READY' && !(c.status === 'CARTERA' && diffDays <= 0 && diffDays >= -30)) return false;
      if (activeFilter === 'UPCOMING' && !(c.status === 'CARTERA' && diffDays >= 1 && diffDays <= 7)) return false;
      if (activeFilter === 'DEFERRED' && !(c.status === 'CARTERA' && diffDays > 7)) return false;
      if (activeFilter === 'DEPOSITADO' && c.status !== 'DEPOSITADO') return false;
      if (activeFilter === 'ENDOSADO' && c.status !== 'ENDOSADO') return false;
      if (activeFilter === 'EXPIRED' && !(c.status === 'RECHAZADO' || (c.status === 'CARTERA' && diffDays < -30))) return false;

      // Filtro por tipo
      if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;

      // Filtro por texto
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchNumber = c.checkNumber?.toLowerCase().includes(q);
        const matchBank = c.bank?.toLowerCase().includes(q);
        const matchIssuer = c.issuer?.toLowerCase().includes(q);
        const matchTaxId = c.issuerTaxId?.toLowerCase().includes(q);
        const matchCustomer = c.customer?.name?.toLowerCase().includes(q);
        const matchEndorsed = c.endorsedTo?.toLowerCase().includes(q);

        if (!matchNumber && !matchBank && !matchIssuer && !matchTaxId && !matchCustomer && !matchEndorsed) {
          return false;
        }
      }

      return true;
    });
  }, [checks, activeFilter, typeFilter, searchTerm, today]);

  // Manejo de eliminar
  const handleDeleteCheck = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este cheque de la cartera?')) return;

    setDeletingCheckId(id);
    try {
      const res = await fetchApi(`/finance/checks/${id}`, { method: 'DELETE' });
      if (res.success) {
        onRefresh();
      } else {
        alert(res.message || 'Error al eliminar el cheque');
      }
    } catch (e: any) {
      alert('Error de conexión al eliminar');
    } finally {
      setDeletingCheckId(null);
    }
  };

  // Abrir modal de acción rápida
  const openAction = (check: CheckItem, type: 'DEPOSIT' | 'ENDORSE' | 'REJECT') => {
    setSelectedActionCheck(check);
    setActionType(type);
    setActionModalOpen(true);
  };

  // Abrir edición
  const openEdit = (check: CheckItem) => {
    setEditingCheck(check);
    setIsEditModalOpen(true);
  };

  // Render del Semáforo para cada cheque
  const renderTrafficLightBadge = (check: CheckItem) => {
    const pDate = new Date(check.paymentDate);
    const checkDateOnly = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
    const diffMs = checkDateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (check.status === 'DEPOSITADO') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cobrado / Depositado</span>
        </span>
      );
    }

    if (check.status === 'ENDOSADO') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
          <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
          <span>Endosado</span>
        </span>
      );
    }

    if (check.status === 'RECHAZADO') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>Rechazado</span>
        </span>
      );
    }

    if (check.status === 'ANULADO') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          <span>Anulado</span>
        </span>
      );
    }

    // Estado CARTERA: Semáforo activo
    if (diffDays <= 0 && diffDays >= -30) {
      // 🟢 VERDE: Listo para cobrar
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>{diffDays === 0 ? '¡Cobro Disponible Hoy!' : `Listo para Cobrar`}</span>
          </span>
          {diffDays < 0 && (
            <span className="text-[10px] text-emerald-400/90 pl-3">
              Habilitado hace {Math.abs(diffDays)} {Math.abs(diffDays) === 1 ? 'día' : 'días'} (restan {30 - Math.abs(diffDays)}d)
            </span>
          )}
        </div>
      );
    }

    if (diffDays >= 1 && diffDays <= 7) {
      // 🟡 AMARILLO: Próximo cobro (1 a 7 días)
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Cobro en {diffDays} {diffDays === 1 ? 'día' : 'días'}</span>
          </span>
          <span className="text-[10px] text-amber-400/80 pl-3">
            Habilita: {pDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      );
    }

    if (diffDays > 7) {
      // 🔵 AZUL: Diferido a futuro (> 7 días)
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span>Diferido ({diffDays} días)</span>
          </span>
          <span className="text-[10px] text-slate-400 pl-3">
            Habilita: {pDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      );
    }

    // 🔴 ROJO: Vencido legalmente (> 30 días sin cobrar)
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>Vencido Legalmente</span>
        </span>
        <span className="text-[10px] text-rose-400/80 pl-3">
          Superó 30 días (+{Math.abs(diffDays)}d)
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ================= TARJETAS DEL SEMÁFORO (KPIs) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total en Cartera */}
        <div
          onClick={() => setActiveFilter('CARTERA')}
          className={`cursor-pointer transition-all rounded-2xl p-4 border ${
            activeFilter === 'CARTERA'
              ? 'bg-slate-800/90 border-slate-600 ring-2 ring-emerald-500/40 shadow-lg'
              : 'glass-panel border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>En Cartera (Total)</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1.5 font-mono">
            ${metrics.totalCarteraAmount.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.totalCarteraCount} {metrics.totalCarteraCount === 1 ? 'cheque pendiente' : 'cheques pendientes'}
          </p>
        </div>

        {/* 🟢 Verde: Listos para Cobrar */}
        <div
          onClick={() => setActiveFilter('READY')}
          className={`cursor-pointer transition-all rounded-2xl p-4 border relative overflow-hidden ${
            activeFilter === 'READY'
              ? 'bg-emerald-950/40 border-emerald-500/80 ring-2 ring-emerald-500 shadow-lg shadow-emerald-950/50'
              : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60'
          }`}
        >
          {metrics.readyCount > 0 && (
            <div className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
          )}
          <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Listos para Cobrar</span>
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400 mt-1.5 font-mono">
            ${metrics.readyAmount.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-emerald-300/80 mt-1">
            {metrics.readyCount} en fecha para depositar hoy
          </p>
        </div>

        {/* 🟡 Amarillo: Próximos 7 días */}
        <div
          onClick={() => setActiveFilter('UPCOMING')}
          className={`cursor-pointer transition-all rounded-2xl p-4 border ${
            activeFilter === 'UPCOMING'
              ? 'bg-amber-950/40 border-amber-500/80 ring-2 ring-amber-500 shadow-lg'
              : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-amber-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Próximos (1 a 7 días)</span>
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400 mt-1.5 font-mono">
            ${metrics.upcomingAmount.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-amber-300/80 mt-1">
            {metrics.upcomingCount} a cobrar esta semana
          </p>
        </div>

        {/* 🔵 Azul: Diferidos > 7 días */}
        <div
          onClick={() => setActiveFilter('DEFERRED')}
          className={`cursor-pointer transition-all rounded-2xl p-4 border ${
            activeFilter === 'DEFERRED'
              ? 'bg-blue-950/40 border-blue-500/80 ring-2 ring-blue-500 shadow-lg'
              : 'bg-blue-950/20 border-blue-500/30 hover:border-blue-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-blue-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>Diferidos (&gt; 7 días)</span>
            </span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-blue-400 mt-1.5 font-mono">
            ${metrics.deferredAmount.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-blue-300/80 mt-1">
            {metrics.deferredCount} cheques a término futuro
          </p>
        </div>

        {/* 🔴 Rojo: Vencidos / Alerta */}
        <div
          onClick={() => setActiveFilter('EXPIRED')}
          className={`cursor-pointer transition-all rounded-2xl p-4 border ${
            activeFilter === 'EXPIRED'
              ? 'bg-rose-950/40 border-rose-500/80 ring-2 ring-rose-500 shadow-lg'
              : 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60'
          }`}
        >
          <div className="flex items-center justify-between text-rose-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>Vencidos / Alerta</span>
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-400 mt-1.5 font-mono">
            ${metrics.expiredAmount.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-rose-300/80 mt-1">
            {metrics.expiredCount} +30d sin depositar
          </p>
        </div>
      </div>

      {/* ================= BARRA DE BÚSQUEDA Y FILTROS ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Pestañas de filtros rápidos */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'ALL'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Todos ({checks.length})
          </button>
          <button
            onClick={() => setActiveFilter('CARTERA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'CARTERA'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            En Cartera ({metrics.totalCarteraCount})
          </button>
          <button
            onClick={() => setActiveFilter('READY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'READY'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Listos ({metrics.readyCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('UPCOMING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'UPCOMING'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Próximos ({metrics.upcomingCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('DEPOSITADO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'DEPOSITADO'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Cobrados ({checks.filter((c) => c.status === 'DEPOSITADO').length})
          </button>
          <button
            onClick={() => setActiveFilter('ENDOSADO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'ENDOSADO'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Endosados ({checks.filter((c) => c.status === 'ENDOSADO').length})
          </button>
        </div>

        {/* Buscador y selector de tipo */}
        <div className="flex items-center gap-2">
          {/* Selector de Tipo (Físico/Echeq) */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="FISICO">Físicos</option>
            <option value="ECHEQ">E-Cheqs</option>
          </select>

          {/* Buscador de texto */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cheque, emisor, banco..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-1.5 px-3.5 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Cargar Cheque</span>
          </button>
        </div>
      </div>

      {/* ================= TABLA DE CHEQUES ================= */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <th className="py-3.5 px-4 font-semibold">Semáforo & Estado</th>
                <th className="py-3.5 px-4 font-semibold">Nº & Tipo</th>
                <th className="py-3.5 px-4 font-semibold">Banco Emisor</th>
                <th className="py-3.5 px-4 font-semibold">Librador / Cliente</th>
                <th className="py-3.5 px-4 font-semibold">Fecha Cobro</th>
                <th className="py-3.5 px-4 font-semibold text-right">Importe</th>
                <th className="py-3.5 px-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CreditCard className="w-10 h-10 text-slate-600 stroke-[1.5]" />
                      <p className="text-sm font-medium text-slate-400">
                        {searchTerm ? 'No se encontraron cheques con ese criterio.' : 'No hay cheques registrados en esta vista.'}
                      </p>
                      <button
                        onClick={onOpenCreateModal}
                        className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        + Cargar el primer cheque
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredChecks.map((check) => {
                  const isCartera = check.status === 'CARTERA';

                  return (
                    <tr
                      key={check.id}
                      className="hover:bg-slate-900/50 transition-colors group"
                    >
                      {/* Semáforo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderTrafficLightBadge(check)}
                      </td>

                      {/* Nº & Tipo */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white text-sm">
                          #{check.checkNumber}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                            check.type === 'ECHEQ'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {check.type === 'ECHEQ' ? <CreditCard className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
                          <span>{check.type}</span>
                        </span>
                      </td>

                      {/* Banco */}
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Landmark className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{check.bank}</span>
                        </div>
                        {check.notes && (
                          <span className="block text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            {check.notes}
                          </span>
                        )}
                      </td>

                      {/* Librador / Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{check.issuer}</div>
                        {check.issuerTaxId && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            CUIT: {check.issuerTaxId}
                          </div>
                        )}
                        {check.customer && (
                          <span className="inline-block mt-0.5 text-[10px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">
                            Cliente: {check.customer.name}
                          </span>
                        )}
                        {check.endorsedTo && check.status === 'ENDOSADO' && (
                          <span className="inline-block mt-0.5 text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">
                            Entregado a: {check.endorsedTo}
                          </span>
                        )}
                        {check.bankAccount && check.status === 'DEPOSITADO' && (
                          <span className="inline-block mt-0.5 text-[10px] text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            Depositado en: {check.bankAccount.bankName}
                          </span>
                        )}
                        {check.cashRegister && check.status === 'DEPOSITADO' && (
                          <span className="inline-block mt-0.5 text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Cobrado en: {check.cashRegister.name}
                          </span>
                        )}
                      </td>

                      {/* Fecha de Cobro */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-white font-medium">
                          {new Date(check.paymentDate).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Emisión: {new Date(check.issueDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </div>
                      </td>

                      {/* Importe */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="text-sm font-bold font-mono text-emerald-400">
                          ${Number(check.amount).toLocaleString('es-AR')}
                        </span>
                        <span className="block text-[10px] text-slate-500">ARS</span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isCartera ? (
                            <>
                              {/* Botón Cobrar / Depositar */}
                              <button
                                onClick={() => openAction(check, 'DEPOSIT')}
                                title="Depositar en cuenta o cobrar en caja"
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Cobrar</span>
                              </button>

                              {/* Botón Endosar */}
                              <button
                                onClick={() => openAction(check, 'ENDORSE')}
                                title="Endosar / Entregar a proveedor"
                                className="px-2 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/30 transition-all flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Endosar</span>
                              </button>

                              {/* Editar */}
                              <button
                                onClick={() => openEdit(check)}
                                title="Editar cheque"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Rechazar */}
                              <button
                                onClick={() => openAction(check, 'REJECT')}
                                title="Marcar como rechazado"
                                className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Eliminar */}
                              <button
                                onClick={() => handleDeleteCheck(check.id)}
                                title="Eliminar registro"
                                disabled={deletingCheckId === check.id}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => openEdit(check)}
                                title="Ver / Editar datos"
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Detalles</span>
                              </button>
                              {check.status !== 'DEPOSITADO' && (
                                <button
                                  onClick={() => handleDeleteCheck(check.id)}
                                  title="Eliminar registro"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL DE EDICIÓN ================= */}
      {isEditModalOpen && (
        <CheckModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingCheck(null);
          }}
          onSuccess={onRefresh}
          checkToEdit={editingCheck}
        />
      )}

      {/* ================= MODAL DE ACCIONES (COBRO / ENDOSO / RECHAZO) ================= */}
      {actionModalOpen && (
        <CheckActionModal
          isOpen={actionModalOpen}
          onClose={() => {
            setActionModalOpen(false);
            setSelectedActionCheck(null);
          }}
          onSuccess={onRefresh}
          check={selectedActionCheck}
          actionType={actionType}
          bankAccounts={bankAccounts}
          cashRegisters={cashRegisters}
        />
      )}
    </div>
  );
}
