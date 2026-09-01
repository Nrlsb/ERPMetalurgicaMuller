'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  DollarSign,
  CreditCard,
  Building,
  CheckCircle,
  X,
  Printer,
  ArrowRight,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  salePrice: number;
  currentStock: number;
  unit?: { symbol: string };
}

interface Customer {
  id: string;
  code: string;
  name: string;
  taxId?: string;
  taxType?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface PosModalProps {
  products: Product[];
  customers: Customer[];
  onSuccess: (newInvoice?: any) => void;
  onClose: () => void;
}

export function PosModal({ products, customers, onSuccess, onClose }: PosModalProps) {
  const { success, error, warning } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CUENTA_CORRIENTE'>('EFECTIVO');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar cliente por defecto (Consumidor Final)
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId) {
      const defaultCust = customers.find(
        (c) => c.name.toLowerCase().includes('consumidor') || c.name.toLowerCase().includes('final')
      );
      setSelectedCustomerId(defaultCust ? defaultCust.id : customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  // Autofoco al campo de búsqueda
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Manejador de búsqueda en vivo
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches = products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          (p.barcode && p.barcode.toLowerCase().includes(query))
      )
      .slice(0, 6);

    setSearchResults(matches);
  }, [searchQuery, products]);

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      warning(`Stock agotado para "${product.name}"`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          warning(`No hay más stock disponible para "${product.name}"`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: Number(product.salePrice), discount: 0 }];
    });

    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Buscar coincidencia exacta de código de barras o SKU
    const exactMatch = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === searchQuery.toLowerCase()) ||
        p.sku.toLowerCase() === searchQuery.toLowerCase()
    );

    if (exactMatch) {
      addToCart(exactMatch);
    } else if (searchResults.length > 0) {
      addToCart(searchResults[0]);
    } else {
      warning('Producto no encontrado con el código o nombre ingresado');
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.currentStock) {
              warning(`Stock máximo disponible alcanzado (${item.product.currentStock})`);
              return item;
            }
            return { ...item, quantity: Math.max(0, newQty) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Cálculos
  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const total = subtotal; // en POS rápido asumimos precio final con impuestos incluidos
  const receivedNum = parseFloat(receivedAmount) || 0;
  const changeAmount = Math.max(0, receivedNum - total);

  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      error('El carrito de compras está vacío');
      return;
    }

    if (!selectedCustomerId) {
      error('Por favor seleccione un cliente');
      return;
    }

    if (paymentMethod === 'EFECTIVO' && receivedAmount && receivedNum < total) {
      error(`El importe abonado ($${receivedNum}) es menor al total de la venta ($${total})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        type: 'RECIBO_X',
        paymentMethod,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
        discount: 0,
        taxRate: 0,
        paidAmount: paymentMethod === 'CUENTA_CORRIENTE' ? 0 : total,
        notes: paymentMethod === 'EFECTIVO' && receivedNum > 0 ? `Abonó con: $${receivedNum}. Vuelto: $${changeAmount}` : '',
      };

      const res = await fetchApi('/sales/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        success(`¡Venta rápida registrada con éxito! Comprobante: ${res.data?.code || ''}`);
        onSuccess(res.data);
      } else {
        error(res.message || 'Error al procesar la venta');
      }
    } catch (e: any) {
      error('Error de red al registrar la venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header POS */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">Punto de Venta Rápido (POS)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Mostrador
                </span>
              </div>
              <p className="text-xs text-slate-400">Escanea códigos de barra o busca por nombre</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cuerpo Principal Dividido */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* Columna Izquierda: Búsqueda y Carrito (7 cols) */}
          <div className="col-span-7 border-r border-slate-800 flex flex-col p-5 bg-slate-900/40">
            {/* Barra de Búsqueda y Lector */}
            <form onSubmit={handleBarcodeSubmit} className="relative mb-4">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escanear código de barras o escribir nombre del producto..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-inner"
              />

              {/* Resultados flotantes */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-20 divide-y divide-slate-700/50">
                  {searchResults.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => addToCart(prod)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-700/60 text-left transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{prod.name}</div>
                        <div className="text-xs text-slate-400">
                          SKU: {prod.sku} {prod.barcode && `| Código: ${prod.barcode}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-400">
                          ${Number(prod.salePrice).toLocaleString('es-AR')}
                        </div>
                        <div className="text-[11px] text-slate-400">Stock: {prod.currentStock}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Listado del Carrito */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <ShoppingCart className="w-12 h-12 stroke-1 mb-2 opacity-40" />
                  <p className="text-sm font-medium">El carrito está vacío</p>
                  <p className="text-xs text-slate-600">Escanea un artículo para comenzar a cobrar</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="text-sm font-bold text-white truncate">{item.product.name}</div>
                      <div className="text-xs text-slate-400">
                        ${item.unitPrice.toLocaleString('es-AR')} c/u
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Controles Cantidad */}
                      <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Subtotal del item */}
                      <div className="text-right w-24">
                        <div className="text-sm font-bold text-white">
                          ${(item.quantity * item.unitPrice).toLocaleString('es-AR')}
                        </div>
                      </div>

                      {/* Eliminar */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.product.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Columna Derecha: Resumen de Pago y Cobro (5 cols) */}
          <div className="col-span-5 flex flex-col p-5 bg-slate-950/40">
            {/* Selección de Cliente */}
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Cliente
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.taxId ? `(${c.taxId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Métodos de Pago */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Forma de Cobro
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'EFECTIVO', label: 'Efectivo', icon: DollarSign },
                  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: Building },
                  { id: 'TARJETA', label: 'Tarjeta (POS)', icon: CreditCard },
                  { id: 'CUENTA_CORRIENTE', label: 'Cta. Corriente', icon: ArrowRight },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = paymentMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPaymentMethod(item.id as any)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cálculo de Vuelto (Si es Efectivo) */}
            {paymentMethod === 'EFECTIVO' && (
              <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Paga con ($):</label>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="Monto entregado"
                    className="w-36 bg-slate-900 border border-slate-600 rounded-xl px-3 py-1.5 text-right font-bold text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                {receivedNum > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                    <span className="text-xs font-bold text-slate-400">VUELTO / CAMBIO:</span>
                    <span
                      className={`text-base font-black ${
                        receivedNum >= total ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ${changeAmount.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Caja de Total Principal */}
            <div className="mt-auto p-5 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl shadow-xl">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Ítems en carrito:</span>
                <span className="font-semibold text-slate-200">
                  {cart.reduce((acc, i) => acc + i.quantity, 0)} u.
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-2 border-t border-slate-700/50">
                <span className="text-sm font-bold text-slate-300">TOTAL A PAGAR:</span>
                <span className="text-3xl font-black text-amber-400 tracking-tight">
                  ${total.toLocaleString('es-AR')}
                </span>
              </div>

              {/* Botón de Finalizar Venta */}
              <button
                type="button"
                onClick={handleSubmitSale}
                disabled={isSubmitting || cart.length === 0}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-2xl text-base shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
              >
                <CheckCircle className="w-5 h-5" />
                {isSubmitting ? 'Procesando Venta...' : 'CONFIRMAR Y COBRAR'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
