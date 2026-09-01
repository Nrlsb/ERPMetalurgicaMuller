'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Users,
  FileText,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building,
  Phone,
  Mail,
  Receipt,
  Eye,
  ArrowDownRight,
  TrendingUp,
  FileCheck2,
  Zap,
  Download,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { exportToCsv } from '@/lib/export';
import { useToast } from '@/context/ToastContext';

// Subcomponentes modulares
import { PosModal } from '@/components/ventas/PosModal';
import { InvoiceModal } from '@/components/ventas/InvoiceModal';
import { QuoteModal } from '@/components/ventas/QuoteModal';
import { CustomerModal } from '@/components/ventas/CustomerModal';
import { ReceivablesView, Receivable } from '@/components/ventas/ReceivablesView';
import { InvoicePrintView } from '@/components/ventas/InvoicePrintView';

// ==========================================
// INTERFACES
// ==========================================

interface Customer {
  id: string;
  code: string;
  name: string;
  taxId?: string;
  taxType?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  creditLimit: number;
  currentBalance: number;
}

interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  salePrice: number;
  currentStock: number;
  unit?: { symbol: string };
}

interface SaleInvoice {
  id: string;
  code: string;
  type: string;
  customer: { id: string; name: string; code: string; taxId?: string };
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  isPaid: boolean;
  paymentMethod: string;
  notes?: string;
  items?: any[];
}

interface Quote {
  id: string;
  code: string;
  customer: { id: string; name: string; taxId?: string };
  createdAt: string;
  validUntil: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  status: string;
  notes?: string;
  items?: any[];
}

export default function VentasPage() {
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes' | 'customers' | 'receivables'>('invoices');

  // Datos
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Estados de control
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<any | null>(null);

  // Carga de Datos desde API
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, quoRes, custRes, recRes, prodRes] = await Promise.all([
        fetchApi<any>('/sales/invoices?limit=100'),
        fetchApi<any>('/sales/quotes?limit=100'),
        fetchApi<any>('/sales/customers?limit=100'),
        fetchApi<any>('/sales/receivables?limit=100'),
        fetchApi<any>('/inventory/products?limit=200'),
      ]);

      if (invRes.success && invRes.data) {
        setInvoices(Array.isArray(invRes.data) ? invRes.data : invRes.data.data || []);
      }
      if (quoRes.success && quoRes.data) {
        setQuotes(Array.isArray(quoRes.data) ? quoRes.data : quoRes.data.data || []);
      }
      if (custRes.success && custRes.data) {
        setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data.data || []);
      }
      if (recRes.success && recRes.data) {
        setReceivables(Array.isArray(recRes.data) ? recRes.data : recRes.data.data || []);
      }
      if (prodRes.success && prodRes.data) {
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data.data || []);
      }
    } catch (e: any) {
      console.error('Error cargando ventas:', e);
      error('Error al sincronizar datos del módulo de ventas');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (activeTab === 'invoices') {
      exportToCsv<SaleInvoice>('Ventas_Facturas', invoices, [
        { header: 'Código', key: 'code' },
        { header: 'Tipo', key: 'type' },
        { header: 'Cliente', key: 'customer.name' },
        { header: 'CUIT', key: 'customer.taxId' },
        { header: 'Fecha', key: 'issueDate', format: (v) => new Date(v).toLocaleDateString('es-AR') },
        { header: 'Medio de Pago', key: 'paymentMethod' },
        { header: 'Total ($)', key: 'total', format: (v) => Number(v).toFixed(2) },
        { header: 'Estado Pago', key: 'isPaid', format: (v) => (v ? 'PAGADA' : 'PENDIENTE') },
      ]);
      success('Listado de facturas exportado a Excel.');
    } else if (activeTab === 'quotes') {
      exportToCsv<Quote>('Presupuestos_Cotizaciones', quotes, [
        { header: 'Código', key: 'code' },
        { header: 'Cliente', key: 'customer.name' },
        { header: 'Fecha Emisión', key: 'createdAt', format: (v) => new Date(v).toLocaleDateString('es-AR') },
        { header: 'Válido Hasta', key: 'validUntil', format: (v) => new Date(v).toLocaleDateString('es-AR') },
        { header: 'Estado', key: 'status' },
        { header: 'Total ($)', key: 'total', format: (v) => Number(v).toFixed(2) },
      ]);
      success('Listado de cotizaciones exportado a Excel.');
    } else if (activeTab === 'customers') {
      exportToCsv<Customer>('Cartera_Clientes', customers, [
        { header: 'Código', key: 'code' },
        { header: 'Nombre / Razón Social', key: 'name' },
        { header: 'CUIT / DNI', key: 'taxId' },
        { header: 'Condición IVA', key: 'taxType' },
        { header: 'Teléfono', key: 'phone' },
        { header: 'Email', key: 'email' },
        { header: 'Saldo Cta Cte ($)', key: 'currentBalance', format: (v) => Number(v).toFixed(2) },
        { header: 'Límite Crédito ($)', key: 'creditLimit', format: (v) => Number(v).toFixed(2) },
      ]);
      success('Cartera de clientes exportada a Excel.');
    } else if (activeTab === 'receivables') {
      exportToCsv<Receivable>('Cuentas_Por_Cobrar', receivables, [
        { header: 'Factura', key: 'invoice.code' },
        { header: 'Cliente', key: 'customer.name' },
        { header: 'Vencimiento', key: 'dueDate', format: (v) => new Date(v).toLocaleDateString('es-AR') },
        { header: 'Total Factura ($)', key: 'totalAmount', format: (v) => Number(v).toFixed(2) },
        { header: 'Saldo Pendiente ($)', key: 'balance', format: (v) => Number(v).toFixed(2) },
        { header: 'Estado', key: 'isSettled', format: (v) => (v ? 'SALDADA' : 'PENDIENTE') },
      ]);
      success('Cuentas por cobrar exportadas a Excel.');
    }
  };

  // KPIs
  const totalBilled = invoices.reduce((acc, i) => acc + Number(i.total), 0);
  const totalReceivable = receivables.filter((r) => !r.isSettled).reduce((acc, r) => acc + Number(r.balance), 0);
  const totalQuotesCount = quotes.filter((q) => q.status === 'EMITIDA').length;

  // Filtros de búsqueda
  const filteredInvoices = invoices.filter(
    (i) =>
      i.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.customer.taxId && i.customer.taxId.includes(searchTerm))
  );

  const filteredQuotes = quotes.filter(
    (q) =>
      q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.taxId && c.taxId.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      {/* Encabezado y Barra de Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Ventas y Facturación</h1>
          <p className="text-sm text-slate-400">
            Control integral de emisión de facturas, punto de venta (POS), cotizaciones y cuentas corrientes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón Punto de Venta Rápido */}
          <button
            onClick={() => setIsPosOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            Punto de Venta (POS)
          </button>

          {/* Botón Nueva Venta */}
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Nueva Factura
          </button>

          {/* Botón Nuevo Presupuesto */}
          <button
            onClick={() => setIsQuoteModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-600/80 hover:bg-purple-600 text-white font-semibold rounded-xl text-sm transition-all"
          >
            <FileCheck2 className="w-4 h-4" />
            Cotización
          </button>

          {/* Botón Nuevo Cliente */}
          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm border border-slate-700 transition-all"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            Cliente
          </button>

          {/* Exportar Excel */}
          <button
            onClick={handleExportExcel}
            title="Exportar a Excel"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Recargar */}
          <button
            onClick={loadData}
            title="Recargar datos"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Facturación Total</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">${totalBilled.toLocaleString('es-AR')}</div>
          <p className="text-xs text-slate-500 mt-1">{invoices.length} comprobantes registrados</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cuentas Corrientes</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400">${totalReceivable.toLocaleString('es-AR')}</div>
          <p className="text-xs text-slate-500 mt-1">Saldo pendiente por cobrar</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cotizaciones Activas</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400">{totalQuotesCount}</div>
          <p className="text-xs text-slate-500 mt-1">Propuestas vigentes</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cartera de Clientes</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{customers.length}</div>
          <p className="text-xs text-slate-500 mt-1">Clientes registrados</p>
        </div>
      </div>

      {/* Selector de Pestañas & Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          {[
            { id: 'invoices', label: 'Facturación / Ventas', icon: FileText, count: invoices.length },
            { id: 'quotes', label: 'Cotizaciones', icon: FileCheck2, count: quotes.length },
            { id: 'receivables', label: 'Cuentas a Cobrar', icon: DollarSign, count: receivables.filter((r) => !r.isSettled).length },
            { id: 'customers', label: 'Clientes', icon: Users, count: customers.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, cliente o CUIT..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Contenido de la Pestaña Activa */}
      {activeTab === 'invoices' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">Comprobante</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Medio de Pago</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No se encontraron comprobantes de venta
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="font-mono text-xs font-bold text-blue-400">{inv.code}</div>
                        <div className="text-[11px] text-slate-500">{inv.type.replace('_', ' ')}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white">{inv.customer.name}</div>
                        <div className="text-xs text-slate-400">{inv.customer.taxId || 'Consumidor Final'}</div>
                      </td>
                      <td className="p-4 text-xs text-slate-300">
                        {new Date(inv.issueDate).toLocaleDateString('es-AR')}
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4 text-right font-black text-white">
                        ${Number(inv.total).toLocaleString('es-AR')}
                      </td>
                      <td className="p-4 text-center">
                        {inv.isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pagada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedDocForPrint(inv)}
                          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="Imprimir / Ver Comprobante"
                        >
                          <Printer className="w-4 h-4 text-blue-400" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'quotes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">Cotización</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Fecha Emisión</th>
                  <th className="p-4">Válido Hasta</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No se encontraron cotizaciones
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-xs font-bold text-purple-400">{q.code}</td>
                      <td className="p-4 font-bold text-white">{q.customer.name}</td>
                      <td className="p-4 text-xs text-slate-300">{new Date(q.createdAt).toLocaleDateString('es-AR')}</td>
                      <td className="p-4 text-xs text-slate-400">{new Date(q.validUntil).toLocaleDateString('es-AR')}</td>
                      <td className="p-4 text-right font-black text-white">${Number(q.total).toLocaleString('es-AR')}</td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {q.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedDocForPrint({ ...q, type: 'COTIZACION', issueDate: q.createdAt, paymentMethod: 'CONTADO' })}
                          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="Imprimir Cotización"
                        >
                          <Printer className="w-4 h-4 text-purple-400" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'receivables' && (
        <ReceivablesView receivables={receivables} onPaymentSuccess={loadData} />
      )}

      {activeTab === 'customers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">Código</th>
                  <th className="p-4">Razón Social / Nombre</th>
                  <th className="p-4">CUIT / DNI</th>
                  <th className="p-4">Condición IVA</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4 text-right">Saldo Deudor</th>
                  <th className="p-4 text-right">Límite Crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-xs text-slate-400">{cust.code}</td>
                      <td className="p-4 font-bold text-white">{cust.name}</td>
                      <td className="p-4 text-xs text-slate-300">{cust.taxId || '-'}</td>
                      <td className="p-4 text-xs text-slate-400">{cust.taxType || 'Cons. Final'}</td>
                      <td className="p-4 text-xs text-slate-300">{cust.phone || '-'}</td>
                      <td className="p-4 text-right font-black text-amber-400">
                        ${Number(cust.currentBalance).toLocaleString('es-AR')}
                      </td>
                      <td className="p-4 text-right text-xs text-slate-400">
                        ${Number(cust.creditLimit).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {isPosOpen && (
        <PosModal
          products={products}
          customers={customers}
          onSuccess={(newInv) => {
            setIsPosOpen(false);
            loadData();
            if (newInv) setSelectedDocForPrint(newInv);
          }}
          onClose={() => setIsPosOpen(false)}
        />
      )}

      {isInvoiceModalOpen && (
        <InvoiceModal
          products={products}
          customers={customers}
          onSuccess={(newInv) => {
            setIsInvoiceModalOpen(false);
            loadData();
            if (newInv) setSelectedDocForPrint(newInv);
          }}
          onClose={() => setIsInvoiceModalOpen(false)}
        />
      )}

      {isQuoteModalOpen && (
        <QuoteModal
          products={products}
          customers={customers}
          onSuccess={(newQuote) => {
            setIsQuoteModalOpen(false);
            loadData();
            if (newQuote) setSelectedDocForPrint({ ...newQuote, type: 'COTIZACION', issueDate: newQuote.createdAt, paymentMethod: 'CONTADO' });
          }}
          onClose={() => setIsQuoteModalOpen(false)}
        />
      )}

      {isCustomerModalOpen && (
        <CustomerModal
          onSuccess={() => {
            setIsCustomerModalOpen(false);
            loadData();
          }}
          onClose={() => setIsCustomerModalOpen(false)}
        />
      )}

      {selectedDocForPrint && (
        <InvoicePrintView invoice={selectedDocForPrint} onClose={() => setSelectedDocForPrint(null)} />
      )}
    </div>
  );
}
