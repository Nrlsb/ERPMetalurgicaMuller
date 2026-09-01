'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Factory,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Layers,
  ScrollText,
  Trash2,
  Edit3,
  ArrowRight,
  Download,
  RefreshCw,
  DollarSign,
  Package,
  Boxes,
  Zap,
  Info,
  X,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { exportToCsv } from '@/lib/export';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

interface MaterialItem {
  id?: string;
  materialId: string;
  quantity: number;
  notes?: string;
  material?: {
    id: string;
    sku: string;
    name: string;
    costPrice: number;
    currentStock: number;
    unit?: { symbol: string };
  };
}

interface Recipe {
  id: string;
  productId: string;
  name: string;
  description?: string;
  laborCost: number;
  otherCost: number;
  materialsCost?: number;
  totalEstimatedUnitCost?: number;
  product: {
    id: string;
    sku: string;
    name: string;
    costPrice: number;
    salePrice: number;
    currentStock: number;
    unit?: { symbol: string };
  };
  items: MaterialItem[];
}

interface ProductionOrder {
  id: string;
  code: string;
  quantity: number;
  status: 'PLANIFICADA' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';
  startDate?: string;
  completedDate?: string;
  totalCost: number;
  unitCost: number;
  notes?: string;
  createdAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
    currentStock: number;
    unit?: { symbol: string };
  };
  recipe?: { id: string; name: string };
  location?: { id: string; name: string };
  items: {
    id: string;
    materialId: string;
    quantityRequired: number;
    quantityConsumed: number;
    unitCost: number;
    totalCost: number;
    material: {
      id: string;
      sku: string;
      name: string;
      currentStock: number;
      unit?: { symbol: string };
    };
  }[];
}

export default function FabricacionPage() {
  const { success, error, warning } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'orders' | 'recipes'>('orders');
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modales
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);

  // Formulario Orden de Fabricación
  const [orderForm, setOrderForm] = useState({
    productId: '',
    quantity: '1',
    notes: '',
    autoComplete: true, // Fabricar y descontar stock inmediatamente por defecto
  });
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Formulario Receta (BOM)
  const [recipeForm, setRecipeForm] = useState<{
    productId: string;
    name: string;
    description: string;
    laborCost: string;
    otherCost: string;
    items: { materialId: string; quantity: string; notes: string }[];
  }>({
    productId: '',
    name: '',
    description: '',
    laborCost: '0',
    otherCost: '0',
    items: [{ materialId: '', quantity: '1', notes: '' }],
  });
  const [isSubmittingRecipe, setIsSubmittingRecipe] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, recipesRes, productsRes] = await Promise.all([
        fetchApi<any>('/production/orders?limit=100'),
        fetchApi<any>('/production/recipes'),
        fetchApi<any>('/inventory/products?limit=200'),
      ]);

      if (ordersRes.success && ordersRes.data) {
        setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data.data || []);
      }
      if (recipesRes.success && recipesRes.data) {
        setRecipes(recipesRes.data);
      }
      if (productsRes.success && productsRes.data) {
        setAllProducts(Array.isArray(productsRes.data) ? productsRes.data : productsRes.data.data || []);
      }
    } catch (e: any) {
      console.error('Error cargando módulo de fabricación:', e);
      error('Error al sincronizar datos de fabricación');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manejador Crear Orden de Fabricación
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.productId) {
      warning('Debes seleccionar el producto a fabricar');
      return;
    }
    const qty = parseInt(orderForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      warning('La cantidad a fabricar debe ser al menos 1 unidad');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetchApi<any>('/production/orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: orderForm.productId,
          quantity: qty,
          notes: orderForm.notes.trim() || undefined,
          autoComplete: orderForm.autoComplete,
        }),
      });

      if (res.success) {
        success(res.message || 'Orden de fabricación registrada con éxito');
        setIsOrderModalOpen(false);
        setOrderForm({ productId: '', quantity: '1', notes: '', autoComplete: true });
        loadData();
      } else {
        error(res.message || 'No se pudo crear la orden de fabricación');
      }
    } catch (err: any) {
      error('Error de conexión al procesar orden de fabricación');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Manejador Completar / Fabricar Orden Existente
  const handleCompleteOrder = async (orderId: string, orderCode: string) => {
    if (!window.confirm(`¿Confirmas la fabricación de la orden ${orderCode}? Esto descontará los materiales del stock.`)) {
      return;
    }

    setCompletingOrderId(orderId);
    try {
      const res = await fetchApi<any>(`/production/orders/${orderId}/complete`, {
        method: 'POST',
      });

      if (res.success) {
        success(`Orden ${orderCode} fabricada. Stock de insumos descontado.`);
        loadData();
      } else {
        error(res.message || 'No se pudo completar la fabricación');
      }
    } catch (err: any) {
      error('Error de conexión al completar la orden');
    } finally {
      setCompletingOrderId(null);
    }
  };

  // Manejador Cancelar Orden
  const handleCancelOrder = async (orderId: string, orderCode: string) => {
    if (!window.confirm(`¿Estás seguro de cancelar la orden ${orderCode}?`)) return;

    try {
      const res = await fetchApi<any>(`/production/orders/${orderId}/cancel`, {
        method: 'POST',
      });
      if (res.success) {
        success(`Orden ${orderCode} cancelada`);
        loadData();
      } else {
        error(res.message || 'No se pudo cancelar la orden');
      }
    } catch (err) {
      error('Error al cancelar la orden');
    }
  };

  // Manejador Guardar Receta (BOM)
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeForm.productId) {
      warning('Debes seleccionar el producto terminado');
      return;
    }
    if (!recipeForm.name.trim()) {
      warning('El nombre de la receta es obligatorio');
      return;
    }

    // Validar items
    const validItems = recipeForm.items.filter((it) => it.materialId && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) {
      warning('Debes agregar al menos 1 material o insumo con cantidad válida');
      return;
    }

    setIsSubmittingRecipe(true);
    try {
      const payload = {
        productId: recipeForm.productId,
        name: recipeForm.name.trim(),
        description: recipeForm.description.trim() || undefined,
        laborCost: parseFloat(recipeForm.laborCost) || 0,
        otherCost: parseFloat(recipeForm.otherCost) || 0,
        items: validItems.map((it) => ({
          materialId: it.materialId,
          quantity: parseFloat(it.quantity),
          notes: it.notes.trim() || undefined,
        })),
      };

      const res = await fetchApi<any>('/production/recipes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        success('Receta guardada exitosamente');
        setIsRecipeModalOpen(false);
        setRecipeForm({
          productId: '',
          name: '',
          description: '',
          laborCost: '0',
          otherCost: '0',
          items: [{ materialId: '', quantity: '1', notes: '' }],
        });
        loadData();
      } else {
        error(res.message || 'Error al guardar la receta');
      }
    } catch (err: any) {
      error('Error de conexión al guardar la receta');
    } finally {
      setIsSubmittingRecipe(false);
    }
  };

  // Manejador Abrir Modal de Edición de Receta
  const handleEditRecipe = (recipe: Recipe) => {
    setRecipeForm({
      productId: recipe.productId,
      name: recipe.name,
      description: recipe.description || '',
      laborCost: String(recipe.laborCost || 0),
      otherCost: String(recipe.otherCost || 0),
      items: recipe.items.map((it) => ({
        materialId: it.materialId,
        quantity: String(it.quantity),
        notes: it.notes || '',
      })),
    });
    setIsRecipeModalOpen(true);
  };

  // Manejador Eliminar Receta
  const handleDeleteRecipe = async (recipeId: string, recipeName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la receta "${recipeName}"?`)) return;

    try {
      const res = await fetchApi<any>(`/production/recipes/${recipeId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        success(`Receta "${recipeName}" eliminada`);
        loadData();
      } else {
        error(res.message || 'No se pudo eliminar la receta');
      }
    } catch (err) {
      error('Error al eliminar la receta');
    }
  };

  // Helper para calcular materiales necesarios en tiempo real en el modal de nueva orden
  const selectedProductRecipe = recipes.find((r) => r.productId === orderForm.productId);
  const orderQtyNum = parseInt(orderForm.quantity, 10) || 1;
  const isStockSufficient =
    selectedProductRecipe?.items.every((it) => {
      const required = Number(it.quantity) * orderQtyNum;
      const current = it.material?.currentStock ?? 0;
      return current >= required;
    }) ?? false;

  // Filtrado de Órdenes
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const activeOrdersCount = orders.filter((o) => o.status === 'PLANIFICADA' || o.status === 'EN_PROCESO').length;
  const completedOrders = orders.filter((o) => o.status === 'COMPLETADA');
  const totalUnitsManufactured = completedOrders.reduce((acc, o) => acc + o.quantity, 0);
  const totalProductionCost = completedOrders.reduce((acc, o) => acc + Number(o.totalCost), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Factory className="w-7 h-7 text-sky-400" />
            Fabricación & Producción
          </h1>
          <p className="text-sm text-slate-400">
            Control de recetas (BOM), órdenes de ensamblado y descuento automático de insumos
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => {
              setRecipeForm({
                productId: '',
                name: '',
                description: '',
                laborCost: '0',
                otherCost: '0',
                items: [{ materialId: '', quantity: '1', notes: '' }],
              });
              setIsRecipeModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 font-bold rounded-xl text-sm border border-slate-700/80 shadow-md transition-all active:scale-[0.98]"
          >
            <ScrollText className="w-4 h-4" />
            <span>Configurar Receta</span>
          </button>

          <button
            onClick={() => {
              setOrderForm({ productId: '', quantity: '1', notes: '', autoComplete: true });
              setIsOrderModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Orden de Fabricación</span>
          </button>

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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Órdenes Activas</span>
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{activeOrdersCount}</div>
          <p className="text-xs text-slate-500 mt-1">En proceso o planificadas</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Fabricado</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {totalUnitsManufactured.toLocaleString('es-AR')} u.
          </div>
          <p className="text-xs text-slate-500 mt-1">{completedOrders.length} órdenes completadas</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recetas Activas (BOM)</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400">{recipes.length}</div>
          <p className="text-xs text-slate-500 mt-1">Productos con receta definida</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Costo Fabricación Total</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400">
            ${totalProductionCost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Insumos y costos aplicados</p>
        </div>
      </div>

      {/* Tabs & Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          {[
            { id: 'orders', label: 'Órdenes de Fabricación', icon: Factory, count: orders.length },
            { id: 'recipes', label: 'Recetas de Materiales (BOM)', icon: ScrollText, count: recipes.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'orders' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PLANIFICADA">Planificadas</option>
              <option value="COMPLETADA">Completadas</option>
              <option value="CANCELADA">Canceladas</option>
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código o producto..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Contenido Pestaña 1: Órdenes de Fabricación */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">Código</th>
                  <th className="p-4">Producto a Fabricar</th>
                  <th className="p-4 text-center">Cantidad</th>
                  <th className="p-4">Insumos y Materiales Requeridos</th>
                  <th className="p-4 text-right">Costo Total</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No hay órdenes de fabricación registradas. ¡Crea una nueva con el botón superior!
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isPending = order.status === 'PLANIFICADA';
                    const isCompleted = order.status === 'COMPLETADA';
                    const isCancelled = order.status === 'CANCELADA';

                    return (
                      <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <div className="font-mono text-xs font-bold text-sky-400">{order.code}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(order.createdAt).toLocaleDateString('es-AR')}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-sky-400 shrink-0" />
                            <span>{order.product.name}</span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono">SKU: {order.product.sku}</div>
                        </td>

                        <td className="p-4 text-center">
                          <span className="px-3 py-1 bg-slate-800 border border-slate-700 font-black text-sky-300 rounded-xl text-sm">
                            {order.quantity} {order.product.unit?.symbol || 'u.'}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="space-y-1">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-xs bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/50 max-w-xs"
                              >
                                <span className="text-slate-300 font-medium truncate">{item.material.name}</span>
                                <span className="text-sky-300 font-mono font-bold shrink-0 ml-2">
                                  {item.quantityRequired} {item.material.unit?.symbol || 'u.'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="p-4 text-right">
                          <div className="font-bold text-white">
                            ${Number(order.totalCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ${Number(order.unitCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })} / u.
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="w-3.5 h-3.5" /> Completada
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              <Clock className="w-3.5 h-3.5" /> Planificada
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3.5 h-3.5" /> Cancelada
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          {isPending && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleCompleteOrder(order.id, order.code)}
                                disabled={completingOrderId === order.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md transition-all active:scale-[0.98]"
                                title="Fabricar y descontar stock de materiales ahora"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                {completingOrderId === order.id ? 'Procesando...' : 'Fabricar'}
                              </button>
                              <button
                                onClick={() => handleCancelOrder(order.id, order.code)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                                title="Cancelar orden"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {isCompleted && (
                            <span className="text-[11px] text-slate-500">
                              {order.completedDate && new Date(order.completedDate).toLocaleDateString('es-AR')}
                            </span>
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
      )}

      {/* Contenido Pestaña 2: Recetas (BOM) */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
              <ScrollText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">No hay recetas de materiales configuradas</h3>
              <p className="text-sm text-slate-400 mb-4">
                Define qué materiales se consumen para fabricar cada producto compuesto.
              </p>
              <button
                onClick={() => setIsRecipeModalOpen(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm"
              >
                + Crear Primera Receta
              </button>
            </div>
          ) : (
            recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider font-mono">
                        {recipe.product.sku}
                      </div>
                      <h3 className="text-base font-bold text-white">{recipe.product.name}</h3>
                      <p className="text-xs text-slate-400">{recipe.name}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditRecipe(recipe)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar receta"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Eliminar receta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista de Insumos */}
                  <div className="space-y-2 mb-4 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Insumos por cada 1 unidad de {recipe.product.name}:
                    </div>
                    {recipe.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 truncate">{item.material?.name}</span>
                        <span className="font-mono font-bold text-sky-300 shrink-0 ml-2">
                          {Number(item.quantity)} {item.material?.unit?.symbol || 'u.'}
                        </span>
                      </div>
                    ))}

                    {(Number(recipe.laborCost) > 0 || Number(recipe.otherCost) > 0) && (
                      <div className="pt-2 border-t border-slate-700/50 flex justify-between text-[11px] text-slate-400">
                        <span>Costos Mano de Obra / Extras:</span>
                        <span className="font-mono font-bold text-slate-300">
                          ${(Number(recipe.laborCost) + Number(recipe.otherCost)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between py-2 border-t border-slate-800 mb-3">
                    <span className="text-xs text-slate-400">Costo Estimado Unitario:</span>
                    <span className="text-base font-black text-emerald-400">
                      ${Number(recipe.totalEstimatedUnitCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setOrderForm({ productId: recipe.productId, quantity: '1', notes: '', autoComplete: true });
                      setIsOrderModalOpen(true);
                    }}
                    className="w-full py-2 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white font-bold rounded-xl text-xs border border-sky-500/30 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Fabricar este Producto</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: NUEVA ORDEN DE FABRICACIÓN */}
      {/* ========================================================================= */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Nueva Orden de Fabricación</h3>
                  <p className="text-xs text-slate-400">Selecciona el producto y cantidad a producir</p>
                </div>
              </div>
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Producto a Fabricar *
                </label>
                <select
                  value={orderForm.productId}
                  onChange={(e) => setOrderForm({ ...orderForm, productId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                >
                  <option value="">Seleccionar Producto Terminado...</option>
                  {recipes.map((r) => (
                    <option key={r.productId} value={r.productId}>
                      {r.product.name} ({r.product.sku}) - Stock actual: {r.product.currentStock}
                    </option>
                  ))}
                </select>
                {recipes.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    No tienes recetas creadas todavía. Crea una receta primero con el botón "+ Configurar Receta".
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Cantidad a Fabricar *
                </label>
                <input
                  type="number"
                  min="1"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 font-bold"
                  required
                />
              </div>

              {/* Vista previa de insumos requeridos vs stock */}
              {selectedProductRecipe && (
                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    <span>Insumos Necesarios</span>
                    <span>Stock Disponible</span>
                  </div>

                  {selectedProductRecipe.items.map((item) => {
                    const required = Number(item.quantity) * orderQtyNum;
                    const available = item.material?.currentStock ?? 0;
                    const hasEnough = available >= required;

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs border ${
                          hasEnough
                            ? 'bg-slate-900/60 border-slate-700/50'
                            : 'bg-rose-500/10 border-rose-500/30'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-white">{item.material?.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {Number(item.quantity)} u. x {orderQtyNum} prod. ={' '}
                            <span className="font-bold text-sky-400">{required} u. necesarias</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-bold ${hasEnough ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {available} {item.material?.unit?.symbol || 'u.'}
                          </div>
                          {!hasEnough && <div className="text-[10px] text-rose-400 font-bold">Faltan {required - available} u.</div>}
                        </div>
                      </div>
                    );
                  })}

                  {!isStockSufficient && (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Atención: No hay stock suficiente de algunos materiales para fabricar esta cantidad.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Opción de procesar de inmediato */}
              <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoCompleteCheck"
                  checked={orderForm.autoComplete}
                  onChange={(e) => setOrderForm({ ...orderForm, autoComplete: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-700 bg-slate-900"
                />
                <label htmlFor="autoCompleteCheck" className="text-xs text-slate-300 font-medium cursor-pointer">
                  <span className="font-bold text-white">⚡ Fabricar de inmediato:</span> Descontar el stock de los
                  materiales y sumar el producto terminado ahora mismo.
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Notas / Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  placeholder="Ej. Orden de fabricación urgente para cliente..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrder || !orderForm.productId || (orderForm.autoComplete && !isStockSufficient)}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition-all flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4" />
                  {isSubmittingOrder ? 'Procesando...' : orderForm.autoComplete ? 'Fabricar y Descontar Stock' : 'Guardar Orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIGURAR / EDITAR RECETA (BOM) */}
      {/* ========================================================================= */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <ScrollText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Configuración de Receta (BOM)</h3>
                  <p className="text-xs text-slate-400">Define los materiales necesarios para fabricar 1 unidad</p>
                </div>
              </div>
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Producto Terminado *
                  </label>
                  <select
                    value={recipeForm.productId}
                    onChange={(e) => setRecipeForm({ ...recipeForm, productId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                    required
                  >
                    <option value="">Seleccionar Producto...</option>
                    {allProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nombre de la Receta *
                  </label>
                  <input
                    type="text"
                    value={recipeForm.name}
                    onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                    placeholder="Ej. Receta Estándar de Fábrica"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={recipeForm.description}
                  onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
                  placeholder="Detalles sobre el proceso de fabricación..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Lista dinámica de materiales */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Insumos / Materiales Requeridos
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRecipeForm({
                        ...recipeForm,
                        items: [...recipeForm.items, { materialId: '', quantity: '1', notes: '' }],
                      })
                    }
                    className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Agregar Insumo
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex-1">
                        <select
                          value={item.materialId}
                          onChange={(e) => {
                            const newItems = [...recipeForm.items];
                            newItems[idx].materialId = e.target.value;
                            setRecipeForm({ ...recipeForm, items: newItems });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                          required
                        >
                          <option value="">Seleccionar Material / Insumo...</option>
                          {allProducts
                            .filter((p) => p.id !== recipeForm.productId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - Costo: ${Number(p.costPrice).toFixed(2)} - Stock: {p.currentStock}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...recipeForm.items];
                            newItems[idx].quantity = e.target.value;
                            setRecipeForm({ ...recipeForm, items: newItems });
                          }}
                          placeholder="Cantidad"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-bold text-center"
                          required
                        />
                      </div>

                      {recipeForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = recipeForm.items.filter((_, i) => i !== idx);
                            setRecipeForm({ ...recipeForm, items: newItems });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Costos adicionales */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Costo Mano de Obra ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={recipeForm.laborCost}
                    onChange={(e) => setRecipeForm({ ...recipeForm, laborCost: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Otros Costos Indirectos ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={recipeForm.otherCost}
                    onChange={(e) => setRecipeForm({ ...recipeForm, otherCost: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecipeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecipe}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition-all"
                >
                  {isSubmittingRecipe ? 'Guardando...' : 'Guardar Receta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
