'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Wallet,
  Users,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetchApi('/dashboard/stats');
        if (res.success && res.data) {
          setStats(res.data);
        } else {
          // Datos iniciales de demostración si la API está en arranque
          setStats({
            kpis: {
              totalProducts: 48,
              criticalStockCount: 3,
              totalCustomers: 124,
              totalSuppliers: 18,
              totalCash: 845200,
              openRegisters: 1,
            },
            monthlySales: [
              { month: 'Mar', ventas: 1450000, compras: 980000 },
              { month: 'Abr', ventas: 1820000, compras: 1200000 },
              { month: 'May', ventas: 2100000, compras: 1450000 },
              { month: 'Jun', ventas: 1950000, compras: 1300000 },
              { month: 'Jul', ventas: 2480000, compras: 1620000 },
              { month: 'Ago', ventas: 2890000, compras: 1750000 },
            ],
            recentSales: [
              {
                id: '1',
                code: 'FAC-2026-0012',
                customer: { name: 'Construcciones del Sur S.A.' },
                total: 185000,
                createdAt: new Date().toISOString(),
                isPaid: true,
              },
              {
                id: '2',
                code: 'FAC-2026-0011',
                customer: { name: 'Ferretería Central SRL' },
                total: 94500,
                createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
                isPaid: true,
              },
              {
                id: '3',
                code: 'FAC-2026-0010',
                customer: { name: 'Juan Carlos Pérez' },
                total: 42000,
                createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
                isPaid: false,
              },
            ],
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 p-6 rounded-3xl border border-slate-800/80">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Hola, {user?.fullName?.split(' ')[0] || 'Administrador'} 👋
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Resumen operativo y comercial de <span className="text-emerald-400 font-medium">Muller Juan ERP</span>
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/inventario"
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-700 transition-colors"
          >
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Ver Inventario</span>
          </Link>
          <Link
            href="/ventas"
            className="inline-flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Venta</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Ventas del Mes */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Ventas del Mes
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white">
              ${(stats?.kpis?.totalSales || 2890000).toLocaleString('es-AR')}{' '}
              <span className="text-xs font-normal text-slate-400">ARS</span>
            </h3>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{stats?.kpis?.totalSales ? 'Total acumulado facturado' : '+16.5% vs mes anterior'}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Stock Crítico */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Alertas de Stock
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white">
              {stats?.kpis?.criticalStockCount || 3}{' '}
              <span className="text-xs font-normal text-slate-400">productos</span>
            </h3>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400 font-medium">
              <span>Bajo el punto de reposición</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Saldo en Cajas y Bancos */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Tesorería y Cajas
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white">
              ${(stats?.kpis?.totalCash || 845200).toLocaleString('es-AR')}
            </h3>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Caja Mostrador Abierta</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Catálogo Activo */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Catálogo de Artículos
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white">
              {stats?.kpis?.totalProducts || 48}{' '}
              <span className="text-xs font-normal text-slate-400">SKUs</span>
            </h3>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 font-medium">
              <span>{stats?.kpis?.totalCustomers || 124} clientes registrados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Performance Chart (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-white text-base">Evolución de Ventas vs Compras</h3>
              <p className="text-xs text-slate-400">Comportamiento financiero en los últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Ventas</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                <span>Compras</span>
              </div>
            </div>
          </div>

          {/* CSS/SVG Bar Chart Visualizer */}
          <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-800">
            {stats?.monthlySales?.map((item: any, idx: number) => {
              const maxVal = 3000000;
              const vHeight = Math.round((item.ventas / maxVal) * 100);
              const cHeight = Math.round((item.compras / maxVal) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-48">
                    {/* Ventas Bar */}
                    <div
                      style={{ height: `${vHeight}%` }}
                      className="w-1/2 bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md group-hover:brightness-110 transition-all relative"
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-white py-1 px-1.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-10">
                        ${(item.ventas / 1000).toFixed(0)}k
                      </div>
                    </div>
                    {/* Compras Bar */}
                    <div
                      style={{ height: `${cHeight}%` }}
                      className="w-1/2 bg-slate-700/70 group-hover:bg-slate-600 rounded-t-md transition-all relative"
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-slate-300 py-1 px-1.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-10">
                        ${(item.compras / 1000).toFixed(0)}k
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{item.month}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Valores expresados en ARS (Pesos Argentinos)</span>
            <span className="text-emerald-400 font-medium">Margen operativo promedio: ~38%</span>
          </div>
        </div>

        {/* Quick Module Shortcuts & Alertas (1 Col) */}
        <div className="space-y-6">
          {/* Stock Crítico Card */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Atención: Stock Mínimo</span>
              </h4>
              <Link href="/inventario" className="text-xs text-emerald-400 hover:underline">
                Ver todos
              </Link>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Cable Unipolar 2.5mm</p>
                  <p className="text-[11px] text-slate-500">SKU: CAB-25-AZUL</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    2 rollos (Mín: 5)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Disyuntor Bipolar 25A</p>
                  <p className="text-[11px] text-slate-500">SKU: DIS-25-BIP</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    3 u (Mín: 8)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Accesos Rápidos */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800/80">
            <h4 className="font-bold text-white text-sm mb-3">Accesos Directos</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/inventario"
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-left transition-colors group"
              >
                <Package className="w-5 h-5 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-semibold text-white">Nuevo Artículo</p>
                <p className="text-[10px] text-slate-400">Cargar al inventario</p>
              </Link>
              <Link
                href="/usuarios"
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-left transition-colors group"
              >
                <Users className="w-5 h-5 text-blue-400 mb-1 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-semibold text-white">Gestionar Roles</p>
                <p className="text-[10px] text-slate-400">Permisos y Accesos</p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800/80">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-white text-base">Últimas Operaciones Comerciales</h3>
            <p className="text-xs text-slate-400">Comprobantes y ventas registradas recientemente</p>
          </div>
          <Link
            href="/ventas"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Ver todo el historial</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-4 font-semibold">Comprobante</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
                <th className="py-3 px-4 font-semibold">Total</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats?.recentSales?.map((sale: any) => (
                <tr key={sale.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">{sale.code}</td>
                  <td className="py-3.5 px-4 text-slate-300">{sale.customer.name}</td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {new Date(sale.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">
                    ${sale.total.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        sale.isPaid
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {sale.isPaid ? 'Cobrado' : 'Cta. Cte.'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
