'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  Building,
  Package,
  Calendar,
  FileText,
  DollarSign,
  Receipt,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface PurchaseHistoryItem {
  id: string;
  invoiceCode: string;
  date: string;
  supplier: {
    id: string;
    code: string;
    companyName: string;
  };
  quantity: number;
  unitCost: number;
  subtotal: number;
  variationPct: number | null;
}

interface ProductPurchaseHistoryData {
  product: {
    id: string;
    name: string;
    sku: string;
    costPrice: number;
    supplierCode?: string;
    unit?: { symbol: string };
  };
  stats: {
    totalPurchasesCount: number;
    totalQtyPurchased: number;
    averageCost: number;
    currentCost: number;
  };
  history: PurchaseHistoryItem[];
}

interface ProductPurchaseHistoryModalProps {
  productId: string | null;
  productName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductPurchaseHistoryModal: React.FC<ProductPurchaseHistoryModalProps> = ({
  productId,
  productName,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<ProductPurchaseHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !productId) return;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchApi(`/purchases/products/${productId}/history`);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || 'No se pudo cargar el historial de compras');
        }
      } catch (err: any) {
        setError(err.message || 'Error de conexión al cargar historial de compras');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [isOpen, productId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Historial de Costos & Compras
                </h3>
                {data?.product.supplierCode && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    Cód. Prov: {data.product.supplierCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {productName || data?.product.name} — <span className="font-mono text-slate-300">{data?.product.sku}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-xs text-slate-400">Consultando adquisiciones registradas...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* KPIs de Adquisición */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Último Costo</div>
                  <div className="text-lg font-black text-emerald-400 mt-1 font-mono">
                    ${Number(data.stats.currentCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Costo Promedio</div>
                  <div className="text-lg font-black text-blue-400 mt-1 font-mono">
                    ${Number(data.stats.averageCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Total Unidades</div>
                  <div className="text-lg font-black text-white mt-1 font-mono">
                    {data.stats.totalQtyPurchased.toLocaleString('es-AR')}{' '}
                    <span className="text-xs font-normal text-slate-400">{data.product.unit?.symbol || 'u'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Facturas / Compras</div>
                  <div className="text-lg font-black text-purple-400 mt-1 font-mono">
                    {data.stats.totalPurchasesCount}
                  </div>
                </div>
              </div>

              {/* Tabla Cronológica */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                  <span>Detalle Cronológico de Compras</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Ordenado desde la más reciente
                  </span>
                </div>

                {data.history.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-800/30 border border-slate-800 text-slate-400 text-xs">
                    No hay registros de compras cargadas para este producto todavía.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 uppercase font-bold border-b border-slate-700">
                          <tr>
                            <th className="py-3 px-4">Fecha</th>
                            <th className="py-3 px-4">Comprobante</th>
                            <th className="py-3 px-4">Proveedor</th>
                            <th className="py-3 px-4 text-center">Cantidad</th>
                            <th className="py-3 px-4 text-right">Costo Unitario</th>
                            <th className="py-3 px-4 text-center">Variación</th>
                            <th className="py-3 px-4 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {data.history.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4 text-slate-300 font-medium">
                                {new Date(item.date).toLocaleDateString('es-AR')}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-teal-400">
                                {item.invoiceCode}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">{item.supplier.companyName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{item.supplier.code}</div>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-slate-200">
                                {item.quantity} {data.product.unit?.symbol || 'u'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                                ${Number(item.unitCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {item.variationPct === null ? (
                                  <span className="text-[10px] text-slate-500">—</span>
                                ) : item.variationPct > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <TrendingUp className="w-3 h-3" /> +{item.variationPct}%
                                  </span>
                                ) : item.variationPct < 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <TrendingDown className="w-3 h-3" /> {item.variationPct}%
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold">0%</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-black text-white">
                                ${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
