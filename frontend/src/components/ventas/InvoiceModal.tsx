'use client';

import React, { useState } from 'react';
import { ShoppingCart, Plus, Trash2, X, DollarSign, Calendar, FileText } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

interface Product {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  currentStock: number;
}

interface Customer {
  id: string;
  name: string;
  taxId?: string;
  code: string;
}

interface InvoiceModalProps {
  customers: Customer[];
  products: Product[];
  onSuccess: (invoice?: any) => void;
  onClose: () => void;
}

export function InvoiceModal({ customers, products, onSuccess, onClose }: InvoiceModalProps) {
  const { success, error, warning } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    customerId: customers[0]?.id || '',
    type: 'RECIBO_X',
    paymentMethod: 'EFECTIVO',
    items: [{ productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.salePrice || 0, discount: 0 }],
    discount: 0,
    taxRate: 0.21,
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    notes: '',
    paidAmount: 0,
  });

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find((p) => p.id === productId);
    const updatedItems = [...form.items];
    updatedItems[index] = {
      ...updatedItems[index],
      productId,
      unitPrice: selectedProd ? Number(selectedProd.salePrice) : 0,
    };
    setForm({ ...form, items: updatedItems });
  };

  const handleItemChange = (index: number, field: string, value: number) => {
    const updatedItems = [...form.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    setForm({ ...form, items: updatedItems });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [
        ...form.items,
        { productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.salePrice || 0, discount: 0 },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (form.items.length === 1) {
      warning('Debe incluir al menos un producto en la factura.');
      return;
    }
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    });
  };

  // Cálculos de Totales
  const subtotal = form.items.reduce((acc, item) => {
    const lineSubtotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    return acc + lineSubtotal;
  }, 0);

  const subtotalAfterDiscount = Math.max(0, subtotal - (form.discount || 0));
  const taxAmount = subtotalAfterDiscount * (form.taxRate || 0);
  const grandTotal = subtotalAfterDiscount + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerId) {
      error('Por favor seleccione un cliente');
      return;
    }

    if (form.items.some((i) => !i.productId || i.quantity <= 0)) {
      error('Revise las cantidades y productos ingresados');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        paidAmount: form.paymentMethod === 'CUENTA_CORRIENTE' ? form.paidAmount : grandTotal,
      };

      const res = await fetchApi('/sales/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        success(`Factura ${res.data?.code || ''} emitida correctamente`);
        onSuccess(res.data);
      } else {
        error(res.message || 'Error al emitir el comprobante');
      }
    } catch (e: any) {
      error('Error de conexión con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Emitir Nueva Venta / Factura</h2>
              <p className="text-xs text-slate-400">Genera comprobantes, descuenta stock y registra en tesorería</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cabecera de la factura */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Cliente *
              </label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.taxId ? `(${c.taxId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Tipo de Comprobante
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="RECIBO_X">Recibo X (Interno)</option>
                <option value="FACTURA_A">Factura A (Resp. Inscripto)</option>
                <option value="FACTURA_B">Factura B (Cons. Final / Exento)</option>
                <option value="FACTURA_C">Factura C (Monotributo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Forma de Pago
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="EFECTIVO">Efectivo (Impacta en Caja)</option>
                <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                <option value="TARJETA">Tarjeta de Débito / Crédito</option>
                <option value="CUENTA_CORRIENTE">Cuenta Corriente (A Crédito)</option>
              </select>
            </div>
          </div>

          {/* Tabla de Productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Productos / Ítems</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar Fila
              </button>
            </div>

            <div className="space-y-2.5">
              {form.items.map((item, idx) => {
                const prod = products.find((p) => p.id === item.productId);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2.5 items-center bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60"
                  >
                    {/* Producto */}
                    <div className="col-span-5">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.currentStock})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Cantidad */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-center font-bold text-white focus:outline-none focus:border-blue-500"
                        placeholder="Cant."
                      />
                    </div>

                    {/* Precio Unitario */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-right text-white focus:outline-none focus:border-blue-500"
                        placeholder="Precio"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="col-span-2 text-right">
                      <div className="text-xs font-bold text-emerald-400">
                        ${(item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100)).toLocaleString('es-AR')}
                      </div>
                    </div>

                    {/* Eliminar */}
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Descuentos, Impuestos y Totales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Observaciones / Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Detalles de entrega, forma de envío, etc."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {form.paymentMethod === 'CUENTA_CORRIENTE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-2 text-sm">
              <div className="flex justify-between text-slate-400 text-xs">
                <span>Subtotal Bruto:</span>
                <span>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Descuento Global ($):</span>
                <input
                  type="number"
                  min="0"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs text-emerald-400 font-bold"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Alícuota IVA (%):</span>
                <select
                  value={form.taxRate}
                  onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="0">0% (Sin IVA)</option>
                  <option value="0.105">10.5%</option>
                  <option value="0.21">21%</option>
                </select>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-700 text-base font-black text-white">
                <span>TOTAL FINAL:</span>
                <span className="text-blue-400">${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Footer Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all"
            >
              {isSubmitting ? 'Emitiendo...' : 'Confirmar y Emitir Factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
