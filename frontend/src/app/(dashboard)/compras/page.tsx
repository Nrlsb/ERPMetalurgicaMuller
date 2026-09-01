'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Building,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Trash2,
  Receipt,
  PackageCheck,
  DollarSign,
  ArrowDownRight,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

// ==========================================
// INTERFACES
// ==========================================

interface Supplier {
  id: string;
  code: string;
  companyName: string;
  contactName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  costPrice: number;
  currentStock: number;
  unit?: { symbol: string };
}

interface PurchaseItem {
  id?: string;
  productId: string;
  product?: { name: string; sku: string };
  quantity: number;
  unitCost: number;
  subtotal: number;
}

interface PurchaseOrder {
  id: string;
  code: string;
  supplier: { id: string; companyName: string; taxId?: string; code: string };
  createdAt: string;
  expectedDate?: string;
  total: number;
  status: string;
  items?: PurchaseItem[];
}

interface PurchaseInvoice {
  id: string;
  code: string;
  supplier: { id: string; companyName: string; taxId?: string; code: string };
  issueDate: string;
  dueDate?: string;
  total: number;
  paidAmount: number;
  isPaid: boolean;
  items?: PurchaseItem[];
}

interface Payable {
  id: string;
  supplier: { id: string; companyName: string; phone?: string; email?: string; taxId?: string };
  invoice: { id: string; code: string; issueDate: string; total: number };
  totalAmount: number;
  balance: number;
  dueDate: string;
  isSettled: boolean;
  payments?: any[];
}

export default function ComprasPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'suppliers' | 'payables'>('orders');

  // Data States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Loading & Search
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);

  // Form: Nueva Orden de Compra
  const [orderForm, setOrderForm] = useState<{
    supplierId: string;
    expectedDate: string;
    items: { productId: string; quantity: number; unitCost: number }[];
    notes: string;
    taxRate: number;
  }>({
    supplierId: '',
    expectedDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    items: [{ productId: '', quantity: 1, unitCost: 0 }],
    notes: '',
    taxRate: 0.21,
  });

  // Form: Recepción & Factura de Compra
  const [invoiceForm, setInvoiceForm] = useState<{
    supplierId: string;
    orderId?: string;
    code: string;
    paymentMethod: string;
    items: { productId: string; quantity: number; unitCost: number }[];
    taxRate: number;
    paidAmount: number;
    dueDate: string;
  }>({
    supplierId: '',
    code: '',
    paymentMethod: 'EFECTIVO',
    items: [{ productId: '', quantity: 1, unitCost: 0 }],
    taxRate: 0.21,
    paidAmount: 0,
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });

  // Form: Nuevo Proveedor
  const [supplierForm, setSupplierForm] = useState({
    companyName: '',
    contactName: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    paymentTerms: 'Contado',
  });

  // Form: Registrar Pago a Proveedor
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'EFECTIVO',
    reference: '',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [suppRes, orderRes, invRes, payRes, prodRes] = await Promise.all([
        fetchApi<Supplier[]>('/purchases/suppliers'),
        fetchApi<PurchaseOrder[]>('/purchases/orders'),
        fetchApi<PurchaseInvoice[]>('/purchases/invoices'),
        fetchApi<Payable[]>('/purchases/payables'),
        fetchApi<Product[]>('/inventory/products'),
      ]);

      if (suppRes.success && suppRes.data) setSuppliers(suppRes.data);
      if (orderRes.success && orderRes.data) setOrders(orderRes.data);
      if (invRes.success && invRes.data) setInvoices(invRes.data);
      if (payRes.success && payRes.data) setPayables(payRes.data);
      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
    } catch (e) {
      console.error('Error cargando compras:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handlers para ítems de Orden de Compra
  const handleOrderItemChange = (index: number, field: string, value: any) => {
    const newItems = [...orderForm.items];
    if (field === 'productId') {
      const selectedProd = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value,
        unitCost: selectedProd ? Number(selectedProd.costPrice) : 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    setOrderForm({ ...orderForm, items: newItems });
  };

  const addOrderItemRow = () => {
    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, { productId: '', quantity: 1, unitCost: 0 }],
    });
  };

  const removeOrderItemRow = (index: number) => {
    if (orderForm.items.length <= 1) return;
    setOrderForm({ ...orderForm, items: orderForm.items.filter((_, i) => i !== index) });
  };

  // Handlers para ítems de Factura de Compra
  const handleInvoiceItemChange = (index: number, field: string, value: any) => {
    const newItems = [...invoiceForm.items];
    if (field === 'productId') {
      const selectedProd = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value,
        unitCost: selectedProd ? Number(selectedProd.costPrice) : 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    setInvoiceForm({ ...invoiceForm, items: newItems });
  };

  const addInvoiceItemRow = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...invoiceForm.items, { productId: '', quantity: 1, unitCost: 0 }],
    });
  };

  const removeInvoiceItemRow = (index: number) => {
    if (invoiceForm.items.length <= 1) return;
    setInvoiceForm({ ...invoiceForm, items: invoiceForm.items.filter((_, i) => i !== index) });
  };

  // Submit Orden de Compra
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (!orderForm.supplierId) {
        setFormError('Selecciona un proveedor');
        setIsSubmitting(false);
        return;
      }

      const invalidItem = orderForm.items.find((i) => !i.productId || i.quantity <= 0);
      if (invalidItem) {
        setFormError('Verifica que todos los ítems tengan un producto y cantidad válida.');
        setIsSubmitting(false);
        return;
      }

      const res = await fetchApi('/purchases/orders', {
        method: 'POST',
        body: JSON.stringify(orderForm),
      });

      if (res.success) {
        setIsOrderModalOpen(false);
        setOrderForm({
          supplierId: '',
          expectedDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
          items: [{ productId: '', quantity: 1, unitCost: 0 }],
          notes: '',
          taxRate: 0.21,
        });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al emitir la orden de compra');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Factura de Compra (Recepción)
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (!invoiceForm.supplierId || !invoiceForm.code.trim()) {
        setFormError('El proveedor y el número de factura son requeridos');
        setIsSubmitting(false);
        return;
      }

      const res = await fetchApi('/purchases/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceForm),
      });

      if (res.success) {
        setIsInvoiceModalOpen(false);
        setInvoiceForm({
          supplierId: '',
          code: '',
          paymentMethod: 'EFECTIVO',
          items: [{ productId: '', quantity: 1, unitCost: 0 }],
          taxRate: 0.21,
          paidAmount: 0,
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al ingresar la factura de compra');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Proveedor
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetchApi('/purchases/suppliers', {
        method: 'POST',
        body: JSON.stringify(supplierForm),
      });

      if (res.success) {
        setIsSupplierModalOpen(false);
        setSupplierForm({
          companyName: '',
          contactName: '',
          taxId: '',
          email: '',
          phone: '',
          address: '',
          paymentTerms: 'Contado',
        });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al registrar proveedor');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error de red');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Pago a Proveedor
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetchApi('/purchases/payments', {
        method: 'POST',
        body: JSON.stringify({
          payableId: selectedPayable.id,
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          reference: paymentForm.reference.trim() || undefined,
          notes: paymentForm.notes.trim() || undefined,
        }),
      });

      if (res.success) {
        setIsPaymentModalOpen(false);
        setSelectedPayable(null);
        setPaymentForm({ amount: 0, method: 'EFECTIVO', reference: '', notes: '' });
        loadAllData();
      } else {
        setFormError(res.message || 'Error al procesar pago');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error al procesar pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Métricas
  const totalPurchases = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalPayables = payables
    .filter((p) => !p.isSettled)
    .reduce((sum, p) => sum + Number(p.balance), 0);
  const totalSuppliersCount = suppliers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-emerald-400" />
            <span>Compras, Proveedores & Recepciones</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Módulo 4 — Órdenes de compra, recepción de insumos con ingreso a stock y cuentas por pagar
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs border border-slate-700 transition-all"
          >
            <Building className="w-4 h-4 text-emerald-400" />
            <span>Nuevo Proveedor</span>
          </button>
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs border border-slate-700 transition-all"
          >
            <PackageCheck className="w-4 h-4 text-teal-400" />
            <span>Recepción / Factura de Compra</span>
          </button>
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Orden de Compra</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium uppercase">Compras Realizadas</p>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1">
            ${totalPurchases.toLocaleString('es-AR')} <span className="text-xs font-normal text-slate-400">ARS</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{invoices.length} recepciones facturadas</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium uppercase">Cuentas por Pagar (Deudas)</p>
            <CreditCard className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-400 mt-1">
            ${totalPayables.toLocaleString('es-AR')} <span className="text-xs font-normal text-slate-400">ARS</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {payables.filter((p) => !p.isSettled).length} facturas pendientes de pago
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium uppercase">Directorio de Proveedores</p>
            <Building className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1">
            {totalSuppliersCount} <span className="text-xs font-normal text-slate-400">empresas</span>
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">Proveedores homologados</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'orders'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Órdenes de Compra ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'invoices'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Recepciones & Facturas de Compra ({invoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Directorio de Proveedores ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payables')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'payables'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cuentas por Pagar ({payables.filter((p) => !p.isSettled).length})</span>
        </button>
      </div>

      {/* ================= TAB 1: ÓRDENES DE COMPRA ================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Nro Orden</th>
                    <th className="py-3 px-4 font-semibold">Proveedor</th>
                    <th className="py-3 px-4 font-semibold">Fecha Emisión</th>
                    <th className="py-3 px-4 font-semibold">Fecha Prevista</th>
                    <th className="py-3 px-4 font-semibold text-right">Monto Total</th>
                    <th className="py-3 px-4 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No hay órdenes de compra registradas. Haz clic en "Nueva Orden de Compra" para emitir una solicitud.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{o.code}</td>
                        <td className="py-3.5 px-4 font-medium text-white">{o.supplier?.companyName}</td>
                        <td className="py-3.5 px-4 text-slate-400">{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {o.expectedDate ? new Date(o.expectedDate).toLocaleDateString('es-AR') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-white">
                          ${Number(o.total).toLocaleString('es-AR')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              o.status === 'RECIBIDA'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {o.status}
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

      {/* ================= TAB 2: FACTURAS DE COMPRA & RECEPCIÓN ================= */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Nro Factura Proveedor</th>
                    <th className="py-3 px-4 font-semibold">Proveedor</th>
                    <th className="py-3 px-4 font-semibold">Fecha Recepción</th>
                    <th className="py-3 px-4 font-semibold text-right">Monto Total</th>
                    <th className="py-3 px-4 font-semibold text-center">Estado de Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No hay facturas de compra registradas aún.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-teal-400">{inv.code}</td>
                        <td className="py-3.5 px-4 font-medium text-white">{inv.supplier?.companyName}</td>
                        <td className="py-3.5 px-4 text-slate-400">{new Date(inv.issueDate).toLocaleDateString('es-AR')}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-white">
                          ${Number(inv.total).toLocaleString('es-AR')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.isPaid
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {inv.isPaid ? 'Pagada' : 'Pendiente de Pago'}
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

      {/* ================= TAB 3: PROVEEDORES ================= */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Código</th>
                    <th className="py-3 px-4 font-semibold">Proveedor / Razón Social</th>
                    <th className="py-3 px-4 font-semibold">CUIT</th>
                    <th className="py-3 px-4 font-semibold">Contacto</th>
                    <th className="py-3 px-4 font-semibold">Condición de Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No hay proveedores registrados.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{s.code}</td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {s.companyName}
                          {s.address && <span className="block text-[10px] text-slate-500">{s.address}</span>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{s.taxId || '—'}</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {s.contactName && <p className="text-white font-medium">{s.contactName}</p>}
                          {s.phone && <p>{s.phone}</p>}
                          {s.email && <p className="text-[10px] text-slate-500">{s.email}</p>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{s.paymentTerms || 'Contado'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: CUENTAS POR PAGAR ================= */}
      {activeTab === 'payables' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Factura Proveedor</th>
                    <th className="py-3 px-4 font-semibold">Proveedor</th>
                    <th className="py-3 px-4 font-semibold">Fecha Emisión</th>
                    <th className="py-3 px-4 font-semibold">Vencimiento</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Factura</th>
                    <th className="py-3 px-4 font-semibold text-right">Saldo Adeudado</th>
                    <th className="py-3 px-4 font-semibold text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {payables.filter((p) => !p.isSettled).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        🎉 ¡Excelente! No tienes deudas pendientes con proveedores.
                      </td>
                    </tr>
                  ) : (
                    payables
                      .filter((p) => !p.isSettled)
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-teal-400">{p.invoice.code}</td>
                          <td className="py-3.5 px-4 font-semibold text-white">{p.supplier.companyName}</td>
                          <td className="py-3.5 px-4 text-slate-400">{new Date(p.invoice.issueDate).toLocaleDateString('es-AR')}</td>
                          <td className="py-3.5 px-4 text-slate-300">{new Date(p.dueDate).toLocaleDateString('es-AR')}</td>
                          <td className="py-3.5 px-4 text-right text-slate-300">
                            ${Number(p.totalAmount).toLocaleString('es-AR')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-rose-400 text-sm">
                            ${Number(p.balance).toLocaleString('es-AR')}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedPayable(p);
                                setPaymentForm({
                                  amount: Number(p.balance),
                                  method: 'EFECTIVO',
                                  reference: '',
                                  notes: '',
                                });
                                setIsPaymentModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 py-1 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Pagar Deuda</span>
                            </button>
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

      {/* ================= MODAL: NUEVA ORDEN DE COMPRA ================= */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl relative my-8 animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="font-bold text-lg text-white">Generar Orden de Compra (OC)</h3>
                <p className="text-xs text-slate-400">Solicitud formal de insumos o mercadería a proveedores</p>
              </div>
              <button
                onClick={() => setIsOrderModalOpen(false)}
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

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Proveedor *</label>
                  <select
                    required
                    value={orderForm.supplierId}
                    onChange={(e) => setOrderForm({ ...orderForm, supplierId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName} {s.taxId ? `(${s.taxId})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha Prevista de Entrega</label>
                  <input
                    type="date"
                    value={orderForm.expectedDate}
                    onChange={(e) => setOrderForm({ ...orderForm, expectedDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Ítems */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Artículos a Solicitar</label>
                  <button
                    type="button"
                    onClick={addOrderItemRow}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Artículo</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {orderForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <div className="flex-1">
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleOrderItemChange(idx, 'productId', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">Seleccionar artículo...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — Stock actual: {p.currentStock}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Cant"
                          value={item.quantity}
                          onChange={(e) => handleOrderItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          placeholder="Costo"
                          value={item.unitCost}
                          onChange={(e) => handleOrderItemChange(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-right text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="w-24 text-right font-mono font-bold text-xs text-emerald-400 px-1">
                        ${(item.quantity * item.unitCost).toLocaleString('es-AR')}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeOrderItemRow(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? 'Generando...' : 'Emitir Orden de Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECEPCIÓN & FACTURA DE COMPRA ================= */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl relative my-8 animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-teal-400" />
                  <span>Recepción de Mercadería & Factura de Compra</span>
                </h3>
                <p className="text-xs text-slate-400">Ingresa stock al inventario, actualiza costos y genera deuda o egreso</p>
              </div>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
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

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Proveedor *</label>
                  <select
                    required
                    value={invoiceForm.supplierId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, supplierId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nro Factura Proveedor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: FC-0001-00045892"
                    value={invoiceForm.code}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Condición de Pago</label>
                  <select
                    value={invoiceForm.paymentMethod}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="EFECTIVO">Efectivo (Egreso de Caja)</option>
                    <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                    <option value="CUENTA_CORRIENTE">Cuenta Corriente (Deuda Pendiente)</option>
                  </select>
                </div>
              </div>

              {/* Ítems a recepcionar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Artículos a Ingresar al Stock</label>
                  <button
                    type="button"
                    onClick={addInvoiceItemRow}
                    className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Artículo</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {invoiceForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <div className="flex-1">
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleInvoiceItemChange(idx, 'productId', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">Seleccionar artículo...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — Stock actual: {p.currentStock}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Cant"
                          value={item.quantity}
                          onChange={(e) => handleInvoiceItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          placeholder="Costo"
                          value={item.unitCost}
                          onChange={(e) => handleInvoiceItemChange(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-right text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="w-24 text-right font-mono font-bold text-xs text-teal-400 px-1">
                        ${(item.quantity * item.unitCost).toLocaleString('es-AR')}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeInvoiceItemRow(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white rounded-xl bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/20"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Recepción e Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: NUEVO PROVEEDOR ================= */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="font-bold text-lg text-white">Registrar Nuevo Proveedor</h3>
                <p className="text-xs text-slate-400">Completa los datos de la empresa o distribuidor</p>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
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

            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Industrias Eléctricas SA"
                  value={supplierForm.companyName}
                  onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    placeholder="Ing. Martín Ramos"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">CUIT</label>
                  <input
                    type="text"
                    placeholder="30-71829304-8"
                    value={supplierForm.taxId}
                    onChange={(e) => setSupplierForm({ ...supplierForm, taxId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+54 11 5555-6666"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="ventas@proveedor.com"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Dirección / Planta</label>
                  <input
                    type="text"
                    placeholder="Parque Industrial Pilar"
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Condición de Pago</label>
                  <input
                    type="text"
                    placeholder="Ej: Contado, 30 días, etc."
                    value={supplierForm.paymentTerms}
                    onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PAGAR A PROVEEDOR ================= */}
      {isPaymentModalOpen && selectedPayable && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-rose-400" />
                  <span>Registrar Pago a Proveedor</span>
                </h3>
                <p className="text-xs text-slate-400">Factura {selectedPayable.invoice.code}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-xs space-y-1.5 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Proveedor:</span>
                <span className="font-bold text-white">{selectedPayable.supplier.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Saldo Adeudado:</span>
                <span className="font-bold text-rose-400 font-mono">
                  ${Number(selectedPayable.balance).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-300">Monto a Abonar ($) *</label>
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, amount: Number(selectedPayable.balance) })}
                    className="text-[11px] font-semibold text-emerald-400 hover:underline"
                  >
                    Liquidar Saldo Total
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  max={Number(selectedPayable.balance)}
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Medio de Pago</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="EFECTIVO">Efectivo (Egreso de Caja)</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  <option value="CHEQUE">Cheque Propio / Terceros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Comprobante de Pago / Referencia</label>
                <input
                  type="text"
                  placeholder="Ej: REC-PROV-9988 o Nro Transferencia"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
