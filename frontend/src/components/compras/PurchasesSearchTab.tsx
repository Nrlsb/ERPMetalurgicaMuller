'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Building,
  Truck,
  Package,
  Calendar,
  DollarSign,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderTree,
  Tag,
  ArrowRight,
  RotateCcw,
  Boxes,
  Receipt,
} from 'lucide-react';

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
  barcode?: string;
  supplierCode?: string;
  name: string;
  costPrice: number;
  currentStock: number;
  categoryId?: string;
  subcategoryId?: string;
  category?: { id?: string; name: string };
  subcategory?: { id?: string; name: string };
  suppliers?: { id: string; companyName: string; code?: string }[];
}

interface PurchaseItem {
  id?: string;
  productId: string;
  product?: { name: string; sku: string; supplierCode?: string };
  quantity: number;
  unitCost: number;
  subtotal: number;
}

interface PurchaseInvoice {
  id: string;
  code: string;
  supplierId?: string;
  supplier: { id: string; companyName: string; taxId?: string; code: string };
  issueDate: string;
  dueDate?: string;
  total: number;
  paidAmount: number;
  isPaid: boolean;
  items?: PurchaseItem[];
  payable?: {
    id: string;
    balance: number;
    isSettled: boolean;
    dueDate?: string;
  };
}

interface CategoryNode {
  id: string;
  name: string;
  parentId?: string | null;
  children?: CategoryNode[];
}

interface PurchasesSearchTabProps {
  suppliers: Supplier[];
  invoices: PurchaseInvoice[];
  products: Product[];
  categories: CategoryNode[];
  onSelectSupplierForPurchase?: (supplierId: string) => void;
}

export const PurchasesSearchTab: React.FC<PurchasesSearchTabProps> = ({
  suppliers,
  invoices,
  products,
  categories,
}) => {
  // Filtros de Proveedores (Columna Izquierda)
  const [supplierCodeFilter, setSupplierCodeFilter] = useState('');
  const [supplierNameFilter, setSupplierNameFilter] = useState('');
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState('ALL');
  const [supplierSubcategoryFilter, setSupplierSubcategoryFilter] = useState('ALL');

  // Filtros de Compras (Columna Derecha)
  const [purchaseSupplierFilter, setPurchaseSupplierFilter] = useState('ALL');
  const [purchaseProductSearch, setPurchaseProductSearch] = useState('');
  const [purchaseMinQty, setPurchaseMinQty] = useState('');
  const [purchaseMinValue, setPurchaseMinValue] = useState('');
  const [purchaseStockFilter, setPurchaseStockFilter] = useState<'ALL' | 'INGRESADO' | 'PENDIENTE'>('ALL');
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState<'ALL' | 'PAGADA' | 'PENDIENTE' | 'VENCIDA'>('ALL');

  // Extraer categorías principales y subcategorías
  const mainCategories = useMemo(() => {
    return categories.filter((c) => !c.parentId);
  }, [categories]);

  const availableSubcategories = useMemo(() => {
    if (supplierCategoryFilter === 'ALL') return [];
    const root = categories.find((c) => c.id === supplierCategoryFilter);
    if (!root || !root.children) return [];

    const flatten = (nodes: CategoryNode[]): CategoryNode[] => {
      let res: CategoryNode[] = [];
      nodes.forEach((n) => {
        res.push(n);
        if (n.children && n.children.length > 0) {
          res = res.concat(flatten(n.children));
        }
      });
      return res;
    };

    return flatten(root.children);
  }, [categories, supplierCategoryFilter]);

  // Filtrado de Proveedores
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      // Filtro por Código
      if (
        supplierCodeFilter.trim() &&
        !sup.code.toLowerCase().includes(supplierCodeFilter.trim().toLowerCase())
      ) {
        return false;
      }

      // Filtro por Nombre
      if (
        supplierNameFilter.trim() &&
        !sup.companyName.toLowerCase().includes(supplierNameFilter.trim().toLowerCase()) &&
        !(sup.contactName && sup.contactName.toLowerCase().includes(supplierNameFilter.trim().toLowerCase()))
      ) {
        return false;
      }

      // Filtro por Categoría / Subcategoría de los productos que provee
      if (supplierCategoryFilter !== 'ALL' || supplierSubcategoryFilter !== 'ALL') {
        const supplierProducts = products.filter((p) =>
          p.suppliers?.some((s) => s.id === sup.id)
        );

        if (supplierCategoryFilter !== 'ALL') {
          const hasCategory = supplierProducts.some(
            (p) => p.categoryId === supplierCategoryFilter || p.category?.id === supplierCategoryFilter
          );
          if (!hasCategory) return false;
        }

        if (supplierSubcategoryFilter !== 'ALL') {
          const hasSubcategory = supplierProducts.some(
            (p) => p.subcategoryId === supplierSubcategoryFilter || p.subcategory?.id === supplierSubcategoryFilter
          );
          if (!hasSubcategory) return false;
        }
      }

      return true;
    });
  }, [
    suppliers,
    products,
    supplierCodeFilter,
    supplierNameFilter,
    supplierCategoryFilter,
    supplierSubcategoryFilter,
  ]);

  // Filtrado de Compras
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Filtro por Proveedor
      if (
        purchaseSupplierFilter !== 'ALL' &&
        inv.supplier?.id !== purchaseSupplierFilter &&
        inv.supplierId !== purchaseSupplierFilter
      ) {
        return false;
      }

      // Filtro por Producto (Cód. proveedor, SKU, Nombre)
      if (purchaseProductSearch.trim()) {
        const term = purchaseProductSearch.trim().toLowerCase();
        const hasMatchingProduct = inv.items?.some((it) => {
          const prodName = it.product?.name?.toLowerCase() || '';
          const prodSku = it.product?.sku?.toLowerCase() || '';
          const suppCode = it.product?.supplierCode?.toLowerCase() || '';
          return prodName.includes(term) || prodSku.includes(term) || suppCode.includes(term);
        });
        if (!hasMatchingProduct) return false;
      }

      // Filtro por Cantidad mínima de algún producto
      if (purchaseMinQty) {
        const minQ = parseInt(purchaseMinQty, 10) || 0;
        const totalQty = inv.items?.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || 0;
        if (totalQty < minQ) return false;
      }

      // Filtro por Valor / Costo mínimo
      if (purchaseMinValue) {
        const minV = parseFloat(purchaseMinValue) || 0;
        if (Number(inv.total) < minV) return false;
      }

      // Filtro por Seguimiento de Pagos
      if (purchasePaymentFilter !== 'ALL') {
        const isOverdue = !inv.isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
        if (purchasePaymentFilter === 'PAGADA' && !inv.isPaid) return false;
        if (purchasePaymentFilter === 'PENDIENTE' && inv.isPaid) return false;
        if (purchasePaymentFilter === 'VENCIDA' && !isOverdue) return false;
      }

      return true;
    });
  }, [
    invoices,
    purchaseSupplierFilter,
    purchaseProductSearch,
    purchaseMinQty,
    purchaseMinValue,
    purchasePaymentFilter,
  ]);

  // Limpiar filtros de proveedores
  const resetSupplierFilters = () => {
    setSupplierCodeFilter('');
    setSupplierNameFilter('');
    setSupplierCategoryFilter('ALL');
    setSupplierSubcategoryFilter('ALL');
  };

  // Limpiar filtros de compras
  const resetPurchaseFilters = () => {
    setPurchaseSupplierFilter('ALL');
    setPurchaseProductSearch('');
    setPurchaseMinQty('');
    setPurchaseMinValue('');
    setPurchaseStockFilter('ALL');
    setPurchasePaymentFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del Buscador */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Buscador Avanzado de Proveedores & Compras
            </h2>
            <p className="text-xs text-slate-400">
              Búsqueda cruzada por código, rubros jerárquicos, código de proveedor, stock y seguimiento de pagos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
            {filteredSuppliers.length} Proveedores
          </span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
            {filteredInvoices.length} Compras
          </span>
        </div>
      </div>

      {/* Panel Dividido en 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* COLUMNA 1: PROVEEDORES */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white tracking-tight">Proveedores</h3>
            </div>
            <button
              onClick={resetSupplierFilters}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              title="Restablecer filtros de proveedores"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          </div>

          {/* Formulario de Filtros de Proveedores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Código
              </label>
              <input
                type="text"
                value={supplierCodeFilter}
                onChange={(e) => setSupplierCodeFilter(e.target.value)}
                placeholder="Ej. PROV-0001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nombre / Razón Social
              </label>
              <input
                type="text"
                value={supplierNameFilter}
                onChange={(e) => setSupplierNameFilter(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Categoría
              </label>
              <select
                value={supplierCategoryFilter}
                onChange={(e) => {
                  setSupplierCategoryFilter(e.target.value);
                  setSupplierSubcategoryFilter('ALL');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Todas las Categorías</option>
                {mainCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Subcategoría
              </label>
              <select
                value={supplierSubcategoryFilter}
                disabled={supplierCategoryFilter === 'ALL' || availableSubcategories.length === 0}
                onChange={(e) => setSupplierSubcategoryFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="ALL">Todas las Subcategorías</option>
                {availableSubcategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    ↳ {sc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resultados de Proveedores */}
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1">
            {filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 text-slate-500 text-xs">
                No se encontraron proveedores que coincidan con los filtros.
              </div>
            ) : (
              filteredSuppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-emerald-500/30 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">{sup.code}</span>
                      <h4 className="text-xs font-bold text-white">{sup.companyName}</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      {sup.taxId && <span>CUIT: {sup.taxId}</span>}
                      {sup.phone && <span>Tel: {sup.phone}</span>}
                      {sup.contactName && <span>Contacto: {sup.contactName}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => setPurchaseSupplierFilter(sup.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    title="Ver compras de este proveedor en el panel derecho"
                  >
                    <span>Ver Compras</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMNA 2: COMPRAS */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-bold text-white tracking-tight">Compras</h3>
            </div>
            <button
              onClick={resetPurchaseFilters}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              title="Restablecer filtros de compras"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          </div>

          {/* Formulario de Filtros de Compras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Proveedor
              </label>
              <select
                value={purchaseSupplierFilter}
                onChange={(e) => setPurchaseSupplierFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="ALL">Todos los Proveedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Producto (Cód. Prov / SKU / Nombre)
              </label>
              <input
                type="text"
                value={purchaseProductSearch}
                onChange={(e) => setPurchaseProductSearch(e.target.value)}
                placeholder="Ej. Cód. Prov, SKU o nombre..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Cantidad Mínima
              </label>
              <input
                type="number"
                min="0"
                value={purchaseMinQty}
                onChange={(e) => setPurchaseMinQty(e.target.value)}
                placeholder="Mínimo de unidades..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Seguimiento de Pagos
              </label>
              <select
                value={purchasePaymentFilter}
                onChange={(e) => setPurchasePaymentFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PAGADA">Pagadas al 100%</option>
                <option value="PENDIENTE">Con Saldo Pendiente</option>
                <option value="VENCIDA">Vencidas</option>
              </select>
            </div>
          </div>

          {/* Resultados de Compras */}
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[500px] pr-1">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 text-slate-500 text-xs">
                No se encontraron compras que coincidan con los filtros.
              </div>
            ) : (
              filteredInvoices.map((inv) => {
                const totalUnits =
                  inv.items?.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || 0;
                const isOverdue =
                  !inv.isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();

                return (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-teal-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-400">{inv.code}</span>
                        <span className="text-xs text-slate-300 font-semibold">{inv.supplier.companyName}</span>
                      </div>
                      <span className="font-mono text-xs font-black text-white">
                        ${Number(inv.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Detalle de Productos (Cód. proveedor, cantidad, valor) */}
                    {inv.items && inv.items.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Productos Comprados ({totalUnits} u.)
                        </div>
                        <div className="space-y-1">
                          {inv.items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-xs text-slate-300">
                              <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                                {it.product?.supplierCode && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                    Cód. Prov: {it.product.supplierCode}
                                  </span>
                                )}
                                <span className="truncate">{it.product?.name || 'Artículo'}</span>
                              </div>
                              <div className="text-right font-mono text-[11px] shrink-0">
                                <span className="font-bold text-slate-200">{it.quantity}u.</span>
                                <span className="text-slate-500"> × </span>
                                <span className="text-emerald-400">${Number(it.unitCost).toLocaleString('es-AR')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Movimiento de stock y Seguimiento de Pagos */}
                    <div className="flex flex-wrap items-center justify-between pt-1 gap-2 text-[11px]">
                      {/* Movimiento de stock */}
                      <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                        <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Ingresado a Depósito Central</span>
                      </span>

                      {/* Seguimiento de pagos */}
                      <div>
                        {inv.isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Pago Completado
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isOverdue
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {isOverdue ? 'Vencida' : 'Pendiente'}
                            {inv.payable && ` (Saldo: $${Number(inv.payable.balance).toLocaleString('es-AR')})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
