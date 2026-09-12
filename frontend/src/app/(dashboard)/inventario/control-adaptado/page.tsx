'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Eye,
  ArrowLeft,
  ArrowRight,
  Clock,
  Layers,
  MapPin,
  RotateCcw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Sparkles,
  Search,
  Filter,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { accessibleAudio } from '@/lib/accessibleAudio';
import DwellTarget from '@/components/accessibility/DwellTarget';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  location?: string;
  currentStock: number;
  minStock: number;
  idealStock: number;
  category?: { id?: string; name: string };
  categoryId?: string;
  unit?: { symbol: string };
}

interface Category {
  id: string;
  name: string;
  _count?: { products: number };
}

export default function ControlAdaptadoPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Estados de Configuración de Accesibilidad Tobii
  const [dwellTimeMs, setDwellTimeMs] = useState<number>(1000);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Estados de Datos
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalProducts, setTotalProducts] = useState<number>(0);

  // Estados de Navegación y Filtros
  // 'categories' | 'products' | 'action' | 'alerts'
  const [viewStep, setViewStep] = useState<'categories' | 'products' | 'action'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL' | 'CRITICAL'>('ALL');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('Todos los Productos');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 4; // 4 productos grandes por pantalla (2x2) óptimo para 15.6"

  // Estado del Producto en Gestión
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState<number>(0);
  const [manualCount, setManualCount] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('CONTEO_FISICO');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastActionMessage, setLastActionMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Inicializar reloj y configuraciones
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    const savedDwell = localStorage.getItem('tobii_dwell_time');
    if (savedDwell !== null) {
      setDwellTimeMs(Number(savedDwell));
    }
    setSoundEnabled(accessibleAudio.isSoundEnabled());

    return () => clearInterval(timer);
  }, []);

  const handleToggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    accessibleAudio.setSoundEnabled(newVal);
    if (newVal) accessibleAudio.playSuccess();
  };

  const handleChangeDwell = (timeMs: number) => {
    setDwellTimeMs(timeMs);
    localStorage.setItem('tobii_dwell_time', String(timeMs));
    accessibleAudio.playSuccess();
  };

  // Cargar Categorías y Productos
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catsRes, prodsRes] = await Promise.all([
        fetchApi<Category[]>('/inventory/categories'),
        fetchApi<Product[]>('/inventory/products?limit=1000'),
      ]);

      if (catsRes.success && catsRes.data) {
        setCategories(catsRes.data);
      }
      if (prodsRes.success && prodsRes.data) {
        setProducts(prodsRes.data);
        setTotalProducts(prodsRes.data.length);
      }
    } catch (err) {
      console.error('Error cargando inventario adaptado:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Productos Filtrados según categoría seleccionada
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'CRITICAL') {
      return products.filter((p) => p.currentStock <= p.minStock);
    }
    if (selectedCategory === 'ALL') {
      return products;
    }
    return products.filter(
      (p) => p.categoryId === selectedCategory || p.category?.id === selectedCategory
    );
  }, [products, selectedCategory]);

  // Paginación de 4 productos
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Conteo de Alertas Críticas
  const criticalCount = useMemo(() => {
    return products.filter((p) => p.currentStock <= p.minStock).length;
  }, [products]);

  // Seleccionar Categoría y avanzar al paso 2
  const handleSelectCategory = (catId: string, name: string) => {
    setSelectedCategory(catId);
    setSelectedCategoryName(name);
    setCurrentPage(1);
    setViewStep('products');
  };

  // Seleccionar Producto y avanzar al paso 3
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setStockDelta(0);
    setManualCount(String(product.currentStock));
    setAdjustmentReason('CONTEO_FISICO');
    setViewStep('action');
  };

  // Acción rápida: Verificar stock idéntico
  const handleConfirmStockMatches = async () => {
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      const res = await fetchApi('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.id,
          deltaQuantity: 0,
          reason: 'CONTEO_FISICO',
          notes: 'Conteo verificado correcto con Tobii TD I-16',
        }),
      });

      if (res.success) {
        accessibleAudio.playSuccess();
        setLastActionMessage({
          text: `✅ ¡Verificado! Stock de "${selectedProduct.name}" confirmado en ${selectedProduct.currentStock} unidades.`,
          type: 'success',
        });
        await loadData();
        setViewStep('products');
      }
    } catch (e) {
      accessibleAudio.playWarning();
    } finally {
      setSubmitting(false);
    }
  };

  // Aplicar ajuste de stock (calculando delta o cantidad absoluta manual)
  const handleExecuteAdjustment = async () => {
    if (!selectedProduct) return;
    setSubmitting(true);

    const targetQty =
      manualCount !== '' && !isNaN(Number(manualCount))
        ? Number(manualCount)
        : Math.max(0, selectedProduct.currentStock + stockDelta);

    try {
      const res = await fetchApi('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.id,
          targetStock: targetQty,
          reason: adjustmentReason,
          notes: `Ajuste mediante sistema accesible Tobii TD I-16`,
        }),
      });

      if (res.success) {
        accessibleAudio.playSuccess();
        setLastActionMessage({
          text: `✅ Stock de "${selectedProduct.name}" actualizado a ${targetQty} unidades exitosamente.`,
          type: 'success',
        });
        setIsConfirmModalOpen(false);
        await loadData();
        setViewStep('products');
      } else {
        accessibleAudio.playWarning();
        alert(res.message || 'Error al actualizar el stock');
      }
    } catch (e) {
      accessibleAudio.playWarning();
    } finally {
      setSubmitting(false);
    }
  };

  // Cálculo del stock resultante proyectado
  const computedStock = useMemo(() => {
    if (!selectedProduct) return 0;
    if (manualCount !== '' && !isNaN(Number(manualCount))) {
      return Math.max(0, Number(manualCount));
    }
    return Math.max(0, selectedProduct.currentStock + stockDelta);
  }, [selectedProduct, stockDelta, manualCount]);

  // Teclado numérico gigante
  const handleNumpadPress = (digit: string) => {
    setManualCount((prev) => {
      const next = prev === '0' ? digit : prev + digit;
      return next.slice(0, 5); // Máximo 5 dígitos
    });
    setStockDelta(0);
  };

  const handleNumpadBackspace = () => {
    setManualCount((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
    setStockDelta(0);
  };

  const handleNumpadClear = () => {
    setManualCount('0');
    setStockDelta(0);
  };

  // Ajuste rápido con delta (+/-)
  const handleAddDelta = (delta: number) => {
    const base =
      manualCount !== '' && !isNaN(Number(manualCount))
        ? Number(manualCount)
        : (selectedProduct?.currentStock || 0);
    const newQty = Math.max(0, base + delta);
    setManualCount(String(newQty));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-3 sm:p-5 select-none">
      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR ACCESIBLE (HIGH CONTRAST & DWELL CONTROLS) */}
      {/* ========================================================================= */}
      <header className="bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-600/30 border-2 border-sky-400 flex items-center justify-center text-sky-300">
            <Eye className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-wide text-white">
                Control de Stock Adaptado
              </h1>
              <span className="bg-sky-500/20 text-sky-300 text-xs px-2.5 py-1 rounded-full border border-sky-500/40 font-bold">
                Tobii TD I-16
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Operador: <strong className="text-slate-200">{user?.fullName || 'Operador Stock'}</strong>
            </p>
          </div>
        </div>

        {/* Reloj y Estado */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800">
          <Clock className="w-5 h-5 text-sky-400" />
          <span className="text-xl font-mono font-bold text-sky-200 tracking-wider">
            {currentTime || '--:--:--'}
          </span>
        </div>

        {/* Controles de Fijación Ocular (Dwell) y Audio */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sonido On / Off */}
          <DwellTarget
            onTrigger={handleToggleSound}
            dwellTimeMs={dwellTimeMs}
            variant={soundEnabled ? 'primary' : 'neutral'}
            className="h-16 px-4 !flex-row gap-2 font-bold min-w-[130px]"
            ariaLabel="Alternar sonido accesible"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-6 h-6 text-sky-200" />
                <span className="text-sm">Sonido: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-6 h-6 text-slate-400" />
                <span className="text-sm">Sonido: OFF</span>
              </>
            )}
          </DwellTarget>

          {/* Selector de Tiempo de Fijación (Dwell) */}
          <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 gap-1.5">
            <div className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1">
              <Eye className="w-4 h-4 text-sky-400" /> Dwell:
            </div>
            {[
              { label: 'Off', ms: 0 },
              { label: '0.8s', ms: 800 },
              { label: '1.0s', ms: 1000 },
              { label: '1.2s', ms: 1200 },
              { label: '1.5s', ms: 1500 },
            ].map((option) => (
              <DwellTarget
                key={option.ms}
                onTrigger={() => handleChangeDwell(option.ms)}
                dwellTimeMs={dwellTimeMs}
                variant={dwellTimeMs === option.ms ? 'primary' : 'outline'}
                className="h-12 w-14 font-extrabold !p-0 text-sm"
              >
                {option.label}
              </DwellTarget>
            ))}
          </div>

          {/* Botón Salir / Volver al ERP */}
          <DwellTarget
            onTrigger={() => router.push('/inventario')}
            dwellTimeMs={dwellTimeMs}
            variant="outline"
            className="h-16 px-5 !flex-row gap-2 font-bold text-rose-300 hover:text-white hover:bg-rose-900/60 border-rose-700/60"
            soundType="cancel"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-sm">Salir al ERP</span>
          </DwellTarget>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MENSAJE DE ÚLTIMA ACCIÓN (CONFIRMACIÓN VISUAL) */}
      {/* ========================================================================= */}
      {lastActionMessage && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/80 text-emerald-200 flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center gap-3 text-lg font-bold">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <span>{lastActionMessage.text}</span>
          </div>
          <DwellTarget
            onTrigger={() => setLastActionMessage(null)}
            dwellTimeMs={dwellTimeMs}
            variant="outline"
            className="h-12 px-4 !flex-row gap-2 text-sm border-emerald-500/40 text-emerald-300"
          >
            <X className="w-5 h-5" /> Cerrar
          </DwellTarget>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARRA DE NAVEGACIÓN DE PASOS (BREADCRUMBS GIGANTES) */}
      {/* ========================================================================= */}
      <nav className="grid grid-cols-3 gap-3 mb-4">
        <DwellTarget
          onTrigger={() => setViewStep('categories')}
          dwellTimeMs={dwellTimeMs}
          variant={viewStep === 'categories' ? 'primary' : 'neutral'}
          className="h-20 font-black text-base sm:text-lg flex-row gap-3 border-2"
        >
          <Layers className="w-7 h-7" />
          <span>1. Categorías</span>
        </DwellTarget>

        <DwellTarget
          onTrigger={() => setViewStep('products')}
          dwellTimeMs={dwellTimeMs}
          variant={viewStep === 'products' ? 'primary' : 'neutral'}
          className="h-20 font-black text-base sm:text-lg flex-row gap-3 border-2"
        >
          <Package className="w-7 h-7" />
          <span className="truncate">2. Productos ({filteredProducts.length})</span>
        </DwellTarget>

        <DwellTarget
          onTrigger={() => {
            if (selectedProduct) setViewStep('action');
          }}
          disabled={!selectedProduct}
          dwellTimeMs={dwellTimeMs}
          variant={viewStep === 'action' ? 'primary' : 'neutral'}
          className="h-20 font-black text-base sm:text-lg flex-row gap-3 border-2"
        >
          <CheckCircle2 className="w-7 h-7" />
          <span>3. Conteo / Ajuste</span>
        </DwellTarget>
      </nav>

      {/* ========================================================================= */}
      {/* VISTA 1: SELECCIÓN DE CATEGORÍAS O ALERTAS */}
      {/* ========================================================================= */}
      {viewStep === 'categories' && (
        <section className="flex-1 flex flex-col bg-slate-900/60 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
              <Layers className="w-7 h-7 text-sky-400" />
              Selecciona una Familia de Productos o Modo:
            </h2>
            <div className="text-sm font-bold text-slate-400">
              Total Artículos en Catálogo: <strong className="text-white">{totalProducts}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
            {/* Tarjeta: Todos los Productos */}
            <DwellTarget
              onTrigger={() => handleSelectCategory('ALL', 'Todos los Productos')}
              dwellTimeMs={dwellTimeMs}
              variant={selectedCategory === 'ALL' ? 'primary' : 'card'}
              className="min-h-[140px] p-6 !items-start justify-between text-left border-2"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-2xl font-black text-white">📦 Catálogo Completo</span>
                <span className="bg-sky-500/30 text-sky-200 px-3 py-1 rounded-full text-base font-bold">
                  {totalProducts} arts.
                </span>
              </div>
              <p className="text-slate-300 text-sm">Ver todos los productos registrados en el sistema</p>
            </DwellTarget>

            {/* Tarjeta: Alertas de Stock Crítico */}
            <DwellTarget
              onTrigger={() => handleSelectCategory('CRITICAL', 'Alertas de Stock Crítico')}
              dwellTimeMs={dwellTimeMs}
              variant={selectedCategory === 'CRITICAL' ? 'danger' : 'card'}
              className="min-h-[140px] p-6 !items-start justify-between text-left border-2 border-rose-500/50"
              soundType="warning"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-2xl font-black text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-7 h-7 text-rose-400 animate-pulse" />
                  Stock Crítico
                </span>
                <span className="bg-rose-500/40 text-rose-100 px-3 py-1 rounded-full text-base font-bold">
                  {criticalCount} urgentes
                </span>
              </div>
              <p className="text-rose-200/80 text-sm">Productos con stock igual o inferior al mínimo requerido</p>
            </DwellTarget>

            {/* Tarjetas Dinámicas de Categorías */}
            {categories.map((cat) => {
              const count = products.filter(
                (p) => p.categoryId === cat.id || p.category?.id === cat.id
              ).length;
              return (
                <DwellTarget
                  key={cat.id}
                  onTrigger={() => handleSelectCategory(cat.id, cat.name)}
                  dwellTimeMs={dwellTimeMs}
                  variant={selectedCategory === cat.id ? 'primary' : 'card'}
                  className="min-h-[140px] p-6 !items-start justify-between text-left border-2"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-2xl font-black text-white truncate max-w-[200px]">
                      {cat.name}
                    </span>
                    <span className="bg-slate-800 text-slate-200 px-3 py-1 rounded-full text-base font-bold border border-slate-700">
                      {count} arts.
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">Explorar artículos de esta sección</p>
                </DwellTarget>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: LISTADO DE PRODUCTOS EN TARJETAS GIGANTES */}
      {/* ========================================================================= */}
      {viewStep === 'products' && (
        <section className="flex-1 flex flex-col bg-slate-900/60 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl">
          {/* Cabecera del Listado */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <DwellTarget
                onTrigger={() => setViewStep('categories')}
                dwellTimeMs={dwellTimeMs}
                variant="outline"
                className="h-16 px-5 !flex-row gap-2 font-black text-base"
                soundType="cancel"
              >
                <ArrowLeft className="w-6 h-6" /> Cambiar Categoría
              </DwellTarget>

              <div>
                <div className="text-xs uppercase font-bold text-sky-400 tracking-wider">
                  Categoría seleccionada:
                </div>
                <h2 className="text-2xl font-black text-white">{selectedCategoryName}</h2>
              </div>
            </div>

            <div className="text-lg font-bold text-slate-300 bg-slate-950 px-5 py-2.5 rounded-2xl border border-slate-800">
              Página <strong className="text-sky-400 text-xl">{currentPage}</strong> de {totalPages} ({filteredProducts.length} artículos)
            </div>
          </div>

          {/* Cuadrícula de 4 Tarjetas Gigantes (2x2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {paginatedProducts.length === 0 ? (
              <div className="col-span-2 flex flex-col items-center justify-center p-12 text-slate-400">
                <Package className="w-16 h-16 mb-4 text-slate-600" />
                <p className="text-xl font-bold">No se encontraron productos en esta categoría.</p>
              </div>
            ) : (
              paginatedProducts.map((prod) => {
                const isCritical = prod.currentStock <= prod.minStock;
                const isLow = prod.currentStock <= prod.minStock * 1.5 && !isCritical;

                return (
                  <DwellTarget
                    key={prod.id}
                    onTrigger={() => handleSelectProduct(prod)}
                    dwellTimeMs={dwellTimeMs}
                    variant={isCritical ? 'card' : 'card'}
                    className={`min-h-[190px] p-6 !items-start justify-between text-left border-2 transition-all ${
                      isCritical
                        ? 'border-rose-500/70 hover:border-rose-400 bg-rose-950/20'
                        : 'border-slate-700/90 hover:border-sky-400'
                    }`}
                  >
                    {/* Fila Superior: SKU y Ubicación */}
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-mono text-lg font-black bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-700 text-sky-300">
                        {prod.sku}
                      </span>

                      <span className="text-sm font-bold text-slate-300 flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-lg">
                        <MapPin className="w-4 h-4 text-amber-400" />
                        {prod.location || 'Depósito General'}
                      </span>
                    </div>

                    {/* Nombre del Producto */}
                    <div className="my-2 w-full">
                      <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                        {prod.name}
                      </h3>
                      <p className="text-slate-400 text-sm truncate">
                        {prod.category?.name || 'Sin categoría'} {prod.description ? `• ${prod.description}` : ''}
                      </p>
                    </div>

                    {/* Fila Inferior: Semáforo de Stock y Botón */}
                    <div className="flex items-center justify-between w-full pt-3 border-t border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div
                          className={`text-2xl sm:text-3xl font-black px-4 py-1.5 rounded-xl border flex items-center gap-2 ${
                            isCritical
                              ? 'bg-rose-600/40 text-rose-200 border-rose-500'
                              : isLow
                              ? 'bg-amber-600/40 text-amber-200 border-amber-500'
                              : 'bg-emerald-600/40 text-emerald-200 border-emerald-500'
                          }`}
                        >
                          {isCritical && <AlertTriangle className="w-6 h-6 text-rose-400" />}
                          {prod.currentStock} {prod.unit?.symbol || 'u.'}
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          Mín: {prod.minStock} | Ideal: {prod.idealStock}
                        </span>
                      </div>

                      <div className="bg-sky-600 hover:bg-sky-500 text-white font-black px-5 py-2.5 rounded-xl text-base shadow-lg">
                        Seleccionar 👉
                      </div>
                    </div>
                  </DwellTarget>
                );
              })
            )}
          </div>

          {/* ========================================================================= */}
          {/* BARRA DE PAGINACIÓN GIGANTE (HEAVY-DUTY HIT TARGETS) */}
          {/* ========================================================================= */}
          <footer className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-800">
            <DwellTarget
              onTrigger={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              dwellTimeMs={dwellTimeMs}
              variant="outline"
              className="h-24 !flex-row gap-4 font-black text-xl sm:text-2xl border-2"
              soundType="cancel"
            >
              <ChevronLeft className="w-10 h-10" />
              <span>⬅️ PÁGINA ANTERIOR</span>
            </DwellTarget>

            <DwellTarget
              onTrigger={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              dwellTimeMs={dwellTimeMs}
              variant="primary"
              className="h-24 !flex-row gap-4 font-black text-xl sm:text-2xl border-2"
            >
              <span>PÁGINA SIGUIENTE ➡️</span>
              <ChevronRight className="w-10 h-10" />
            </DwellTarget>
          </footer>
        </section>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: PANEL DE CONTEO Y AJUSTE DE STOCK */}
      {/* ========================================================================= */}
      {viewStep === 'action' && selectedProduct && (
        <section className="flex-1 flex flex-col bg-slate-900/60 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl">
          {/* Encabezado del Producto Seleccionado */}
          <div className="bg-slate-950 p-5 rounded-2xl border-2 border-slate-800 mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <DwellTarget
                onTrigger={() => setViewStep('products')}
                dwellTimeMs={dwellTimeMs}
                variant="outline"
                className="h-16 px-5 !flex-row gap-2 font-black text-base"
                soundType="cancel"
              >
                <ArrowLeft className="w-6 h-6" /> Volver
              </DwellTarget>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-black bg-slate-800 text-sky-400 px-3 py-1 rounded-md">
                    {selectedProduct.sku}
                  </span>
                  <span className="text-sm text-slate-400 font-bold">
                    Ubicación: <strong className="text-white">{selectedProduct.location || 'Depósito General'}</strong>
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  {selectedProduct.name}
                </h2>
              </div>
            </div>

            {/* Comparativa de Stock Actual vs Proyectado */}
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 px-5 py-3 rounded-2xl border border-slate-800 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase">Stock Actual</div>
                <div className="text-3xl font-black text-slate-200">
                  {selectedProduct.currentStock} <span className="text-lg font-normal">{selectedProduct.unit?.symbol || 'u.'}</span>
                </div>
              </div>

              <div className="text-3xl text-sky-400 font-black">➔</div>

              <div className="bg-sky-950/80 px-6 py-3 rounded-2xl border-2 border-sky-500 text-center shadow-lg shadow-sky-500/20">
                <div className="text-xs font-bold text-sky-300 uppercase">Nuevo Stock</div>
                <div className="text-4xl font-black text-sky-200">
                  {computedStock} <span className="text-xl font-normal">{selectedProduct.unit?.symbol || 'u.'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grilla Principal de Acciones de Control */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            {/* Columna Izquierda: Acción Inmediata (Stock Coincide) y Botones de Incremento/Decremento */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* BOTÓN GIGANTE: STOCK CORRECTO (COINCIDE) */}
              <DwellTarget
                onTrigger={handleConfirmStockMatches}
                disabled={submitting}
                dwellTimeMs={dwellTimeMs}
                variant="success"
                className="min-h-[110px] p-6 !flex-row gap-4 text-xl sm:text-2xl font-black border-2 border-emerald-400/50 shadow-xl"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-100 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-white text-2xl font-black">✅ STOCK FÍSICO COINCIDE ({selectedProduct.currentStock})</div>
                  <p className="text-emerald-100/80 text-sm font-semibold">
                    Confirmar que el conteo en estantería es correcto sin realizar ajustes
                  </p>
                </div>
              </DwellTarget>

              {/* AJUSTES RÁPIDOS INCREMENTALES (+ / -) */}
              <div className="bg-slate-950/90 p-5 rounded-2xl border border-slate-800 flex-1 flex flex-col justify-between">
                <div className="text-sm font-bold text-slate-300 mb-3 flex items-center justify-between">
                  <span>Ajustes Rápidos de Cantidad:</span>
                  <span className="text-xs text-slate-500">Haz clic o fija la mirada para sumar/restar</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  {/* Restar */}
                  <DwellTarget
                    onTrigger={() => handleAddDelta(-10)}
                    dwellTimeMs={dwellTimeMs}
                    variant="danger"
                    className="h-20 font-black text-2xl"
                    soundType="cancel"
                  >
                    - 10
                  </DwellTarget>
                  <DwellTarget
                    onTrigger={() => handleAddDelta(-5)}
                    dwellTimeMs={dwellTimeMs}
                    variant="danger"
                    className="h-20 font-black text-2xl"
                    soundType="cancel"
                  >
                    - 5
                  </DwellTarget>
                  <DwellTarget
                    onTrigger={() => handleAddDelta(-1)}
                    dwellTimeMs={dwellTimeMs}
                    variant="danger"
                    className="h-20 font-black text-2xl"
                    soundType="cancel"
                  >
                    - 1
                  </DwellTarget>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Sumar */}
                  <DwellTarget
                    onTrigger={() => handleAddDelta(1)}
                    dwellTimeMs={dwellTimeMs}
                    variant="primary"
                    className="h-20 font-black text-2xl"
                  >
                    + 1
                  </DwellTarget>
                  <DwellTarget
                    onTrigger={() => handleAddDelta(5)}
                    dwellTimeMs={dwellTimeMs}
                    variant="primary"
                    className="h-20 font-black text-2xl"
                  >
                    + 5
                  </DwellTarget>
                  <DwellTarget
                    onTrigger={() => handleAddDelta(10)}
                    dwellTimeMs={dwellTimeMs}
                    variant="primary"
                    className="h-20 font-black text-2xl"
                  >
                    + 10
                  </DwellTarget>
                </div>

                {/* Selector de Motivo con botones grandes */}
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <div className="text-xs font-bold text-slate-400 mb-2">Motivo del Ajuste:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'CONTEO_FISICO', label: 'Conteo Físico' },
                      { id: 'INGRESO_RAPIDO', label: 'Ingreso Merc.' },
                      { id: 'EGRESO_RAPIDO', label: 'Salida Stock' },
                      { id: 'ROTURA', label: 'Rotura / Merma' },
                    ].map((reason) => (
                      <DwellTarget
                        key={reason.id}
                        onTrigger={() => setAdjustmentReason(reason.id)}
                        dwellTimeMs={dwellTimeMs}
                        variant={adjustmentReason === reason.id ? 'primary' : 'outline'}
                        className="h-14 font-bold text-xs !p-1"
                      >
                        {reason.label}
                      </DwellTarget>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Teclado Numérico Gigante para conteo exacto */}
            <div className="lg:col-span-5 bg-slate-950/90 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-slate-300">Teclado Numérico Directo:</span>
                <span className="font-mono text-xl font-black text-sky-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                  Valor: {manualCount}
                </span>
              </div>

              {/* Grilla 3x4 de Botones Numéricos */}
              <div className="grid grid-cols-3 gap-2.5 flex-1 mb-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <DwellTarget
                    key={digit}
                    onTrigger={() => handleNumpadPress(digit)}
                    dwellTimeMs={dwellTimeMs}
                    variant="neutral"
                    className="h-16 font-mono font-black text-3xl"
                  >
                    {digit}
                  </DwellTarget>
                ))}
                <DwellTarget
                  onTrigger={handleNumpadClear}
                  dwellTimeMs={dwellTimeMs}
                  variant="outline"
                  className="h-16 font-bold text-base text-rose-400"
                  soundType="cancel"
                >
                  C (Limpiar)
                </DwellTarget>
                <DwellTarget
                  onTrigger={() => handleNumpadPress('0')}
                  dwellTimeMs={dwellTimeMs}
                  variant="neutral"
                  className="h-16 font-mono font-black text-3xl"
                >
                  0
                </DwellTarget>
                <DwellTarget
                  onTrigger={handleNumpadBackspace}
                  dwellTimeMs={dwellTimeMs}
                  variant="outline"
                  className="h-16 font-bold text-base text-amber-400"
                  soundType="cancel"
                >
                  ⌫ Borrar
                </DwellTarget>
              </div>

              {/* Botón Principal para Abrir Confirmación */}
              <DwellTarget
                onTrigger={() => setIsConfirmModalOpen(true)}
                disabled={computedStock === selectedProduct.currentStock}
                dwellTimeMs={dwellTimeMs}
                variant="warning"
                className="h-20 font-black text-xl border-2 border-amber-400/60 shadow-xl"
              >
                💾 GUARDAR NUEVO STOCK ({computedStock})
              </DwellTarget>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMACIÓN ANTI-MIDAS TOUCH */}
      {/* ========================================================================= */}
      {isConfirmModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-500/80 rounded-3xl p-6 sm:p-8 max-w-2xl w-full text-center shadow-2xl animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto mb-4 text-amber-300">
              <AlertTriangle className="w-12 h-12" />
            </div>

            <h3 className="text-3xl font-black text-white mb-2">
              ¿Confirmar Ajuste de Stock?
            </h3>
            <p className="text-xl text-slate-300 mb-6">
              El producto <strong className="text-white">"{selectedProduct.name}"</strong> pasará de{' '}
              <span className="font-bold text-rose-400">{selectedProduct.currentStock}</span> a{' '}
              <span className="font-bold text-emerald-400 text-2xl">{computedStock}</span> unidades.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DwellTarget
                onTrigger={() => setIsConfirmModalOpen(false)}
                dwellTimeMs={dwellTimeMs}
                variant="outline"
                className="h-24 font-black text-xl border-2 border-slate-600 text-slate-300"
                soundType="cancel"
              >
                ❌ Cancelar
              </DwellTarget>

              <DwellTarget
                onTrigger={handleExecuteAdjustment}
                disabled={submitting}
                dwellTimeMs={dwellTimeMs}
                variant="success"
                className="h-24 font-black text-xl sm:text-2xl border-2 border-emerald-400 shadow-2xl"
              >
                {submitting ? 'Guardando...' : '✅ SÍ, CONFIRMAR'}
              </DwellTarget>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
