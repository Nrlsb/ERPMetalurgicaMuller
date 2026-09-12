'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Tag,
  Layers,
  X,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw,
  TrendingUp,
  DollarSign,
  FolderPlus,
  Trash2,
  Folder,
  Factory,
  Edit3,
  CornerDownRight,
  FolderTree,
  MapPin,
  Building,
  Truck,
  Percent,
  Barcode,
  FileText,
  Boxes,
  Info,
  Camera,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { exportToCsv } from '@/lib/export';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { BarcodeScannerModal } from '@/components/inventario/BarcodeScannerModal';
import { ProductPurchaseHistoryModal } from '@/components/inventario/ProductPurchaseHistoryModal';

interface SupplierItem {
  id: string;
  code?: string;
  companyName: string;
}

interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  parent?: { id: string; name: string };
  children?: CategoryItem[];
  _count?: { products: number; subProducts?: number };
}

// Helpers para estructura jerárquica multinivel
function buildCategoryTree(cats: CategoryItem[]): CategoryItem[] {
  const map = new Map<string, CategoryItem>();
  cats.forEach((c) => {
    map.set(c.id, { ...c, children: [] });
  });

  const roots: CategoryItem[] = [];
  map.forEach((c) => {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children!.push(c);
    } else if (!c.parentId) {
      roots.push(c);
    }
  });
  return roots;
}

function flattenCategoryTree(
  nodes: CategoryItem[],
  depth = 0,
  parentPath = ''
): { item: CategoryItem; depth: number; fullPath: string }[] {
  let list: { item: CategoryItem; depth: number; fullPath: string }[] = [];
  for (const node of nodes) {
    const fullPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    list.push({ item: node, depth, fullPath });
    if (node.children && node.children.length > 0) {
      list = list.concat(flattenCategoryTree(node.children, depth + 1, fullPath));
    }
  }
  return list;
}

function getCategoryPath(catId?: string | null, cats: CategoryItem[] = []): string[] {
  if (!catId) return [];
  const path: string[] = [];
  let current: CategoryItem | undefined = cats.find((c) => c.id === catId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.name);
    const parentId = current.parentId;
    current = parentId ? cats.find((c) => c.id === parentId) : undefined;
  }
  return path;
}

function getTotalCategoryProducts(cat: CategoryItem): number {
  const direct = (cat._count?.products || 0) + (cat._count?.subProducts || 0);
  const fromChildren = (cat.children || []).reduce(
    (acc, child) => acc + getTotalCategoryProducts(child),
    0
  );
  return direct + fromChildren;
}

function countTotalDescendants(cat: CategoryItem): number {
  const children = cat.children || [];
  return children.reduce((acc, ch) => acc + 1 + countTotalDescendants(ch), 0);
}

interface Product {
  id: string;
  sku: string;
  barcode?: string;
  supplierCode?: string;
  name: string;
  description?: string;
  location?: string;
  category?: { id?: string; name: string };
  categoryId?: string;
  subcategory?: { id?: string; name: string };
  subcategoryId?: string;
  costPrice: number;
  markup?: number;
  salePrice: number;
  iva?: number;
  minStock: number;
  idealStock: number;
  currentStock: number;
  unit?: { symbol: string };
  suppliers?: SupplierItem[];
}

interface StockMovement {
  id: string;
  code: string;
  type: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  user?: { fullName: string };
  originLocation?: { name: string };
  destLocation?: { name: string };
  items: {
    id: string;
    quantity: number;
    unitCost: number;
    product: { id: string; sku: string; name: string };
  }[];
}

export default function InventarioPage() {
  const { success, error, warning } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isOperator = user?.role === 'OPERADOR';
  const canSeeFinancials = !isOperator && (user?.role === 'ADMIN' || user?.role === 'FINANZAS' || !user?.role);

  const [activeTab, setActiveTab] = useState<'catalog' | 'movements' | 'alerts'>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados de edición y eliminación de producto
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Modal y formulario de gestión de categorías y subcategorías
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    parentId: '',
  });
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Estados para escáner e historial de compras
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [purchaseHistoryProductId, setPurchaseHistoryProductId] = useState<string | null>(null);
  const [purchaseHistoryProductName, setPurchaseHistoryProductName] = useState<string>('');

  // Formulario producto
  const [formData, setFormData] = useState<{
    sku: string;
    barcode: string;
    supplierCode: string;
    name: string;
    description: string;
    location: string;
    categoryId: string;
    subcategoryId: string;
    costPrice: string;
    markup: string;
    salePrice: string;
    iva: string;
    supplierIds: string[];
    minStock: string;
    idealStock: string;
    initialStock: string;
  }>({
    sku: '',
    barcode: '',
    supplierCode: '',
    name: '',
    description: '',
    location: '',
    categoryId: '',
    subcategoryId: '',
    costPrice: '',
    markup: '0',
    salePrice: '',
    iva: '21',
    supplierIds: [],
    minStock: '5',
    idealStock: '20',
    initialStock: '0',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [res, catRes, movRes, suppRes] = await Promise.all([
        fetchApi<any>('/inventory/products?limit=200'),
        fetchApi<any>('/inventory/categories'),
        fetchApi<any>('/inventory/movements?limit=100'),
        fetchApi<any>('/purchases/suppliers?limit=200'),
      ]);

      if (res.success && res.data) {
        setProducts(Array.isArray(res.data) ? res.data : res.data.data || []);
      }
      if (catRes.success && catRes.data) {
        setCategories(catRes.data);
      }
      if (movRes.success && movRes.data) {
        setMovements(Array.isArray(movRes.data) ? movRes.data : movRes.data.data || []);
      }
      if (suppRes.success && suppRes.data) {
        const suppData = Array.isArray(suppRes.data) ? suppRes.data : suppRes.data.data || [];
        setSuppliers(suppData);
      }
    } catch (e: any) {
      console.error('Error cargando inventario:', e);
      error('Error al sincronizar inventario');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Estructura de árbol jerárquico multinivel
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategoryTree = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const mainCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  // Subcategorías disponibles para el producto (todos los descendientes anidados)
  const availableSubcategories = useMemo(() => {
    if (!formData.categoryId) return [];
    const rootNode = categoryTree.find((c) => c.id === formData.categoryId);
    if (!rootNode || !rootNode.children || rootNode.children.length === 0) return [];
    return flattenCategoryTree(rootNode.children, 1, rootNode.name);
  }, [formData.categoryId, categoryTree]);

  // Cálculos dinámicos bidireccionales de Markup y Precios
  const handleCostChange = (val: string) => {
    const numCost = parseFloat(val) || 0;
    const numMarkup = parseFloat(formData.markup) || 0;
    if (numCost > 0 && numMarkup > 0) {
      const calculatedSale = numCost * (1 + numMarkup / 100);
      setFormData((prev) => ({
        ...prev,
        costPrice: val,
        salePrice: calculatedSale.toFixed(2),
      }));
    } else {
      setFormData((prev) => ({ ...prev, costPrice: val }));
    }
  };

  const handleMarkupChange = (val: string) => {
    const numMarkup = parseFloat(val) || 0;
    const numCost = parseFloat(formData.costPrice) || 0;
    if (numCost > 0) {
      const calculatedSale = numCost * (1 + numMarkup / 100);
      setFormData((prev) => ({
        ...prev,
        markup: val,
        salePrice: calculatedSale.toFixed(2),
      }));
    } else {
      setFormData((prev) => ({ ...prev, markup: val }));
    }
  };

  const handleSalePriceChange = (val: string) => {
    const numSale = parseFloat(val) || 0;
    const numCost = parseFloat(formData.costPrice) || 0;
    if (numCost > 0 && numSale >= numCost) {
      const calculatedMarkup = ((numSale - numCost) / numCost) * 100;
      setFormData((prev) => ({
        ...prev,
        salePrice: val,
        markup: calculatedMarkup.toFixed(2),
      }));
    } else {
      setFormData((prev) => ({ ...prev, salePrice: val }));
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      barcode: '',
      supplierCode: '',
      name: '',
      description: '',
      location: '',
      categoryId: '',
      subcategoryId: '',
      costPrice: '',
      markup: '0',
      salePrice: '',
      iva: '21',
      supplierIds: [],
      minStock: '5',
      idealStock: '20',
      initialStock: '0',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    let catId =
      p.categoryId || p.category?.id || categories.find((c) => c.name === p.category?.name)?.id || '';
    const subCatId =
      p.subcategoryId || p.subcategory?.id || '';

    // Si tiene subcategoría pero el categoryId no es raíz (o está vacío), encontrar la categoría raíz
    if (subCatId && (!catId || categories.find((c) => c.id === catId)?.parentId)) {
      let curr: CategoryItem | undefined = categories.find((c) => c.id === subCatId);
      const visited = new Set<string>();
      while (curr && curr.parentId && !visited.has(curr.id)) {
        visited.add(curr.id);
        const parentId = curr.parentId;
        const parent = categories.find((c) => c.id === parentId);
        if (parent) {
          curr = parent;
        } else {
          break;
        }
      }
      if (curr && !curr.parentId) {
        catId = curr.id;
      }
    }

    const numCost = Number(p.costPrice || 0);
    const numSale = Number(p.salePrice || 0);
    let initialMarkup = p.markup !== undefined ? String(p.markup) : '0';
    if ((p.markup === undefined || Number(p.markup) === 0) && numCost > 0 && numSale >= numCost) {
      initialMarkup = (((numSale - numCost) / numCost) * 100).toFixed(2);
    }

    setFormData({
      sku: p.sku || '',
      barcode: p.barcode || '',
      supplierCode: p.supplierCode || '',
      name: p.name || '',
      description: p.description || '',
      location: p.location || '',
      categoryId: catId,
      subcategoryId: subCatId,
      costPrice: String(p.costPrice || 0),
      markup: initialMarkup,
      salePrice: String(p.salePrice || 0),
      iva: String(p.iva ?? 21),
      supplierIds: p.suppliers ? p.suppliers.map((s) => s.id) : [],
      minStock: String(p.minStock ?? 5),
      idealStock: String(p.idealStock ?? 20),
      initialStock: String(p.currentStock ?? 0),
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) {
      warning('El SKU y Nombre del producto son obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = !!editingProduct;
      const endpoint = isEditing ? `/inventory/products/${editingProduct.id}` : '/inventory/products';
      const method = isEditing ? 'PUT' : 'POST';

      const payload: any = {
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim() || undefined,
        supplierCode: formData.supplierCode.trim() || undefined,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        location: formData.location.trim() || undefined,
        categoryId: formData.categoryId || undefined,
        subcategoryId: formData.subcategoryId || undefined,
        costPrice: parseFloat(formData.costPrice) || 0,
        markup: parseFloat(formData.markup) || 0,
        salePrice: parseFloat(formData.salePrice) || 0,
        iva: parseFloat(formData.iva) || 0,
        supplierIds: formData.supplierIds,
        minStock: parseInt(formData.minStock, 10) || 5,
        idealStock: parseInt(formData.idealStock, 10) || 20,
      };

      if (!isEditing) {
        payload.initialStock = parseInt(formData.initialStock, 10) || 0;
      }

      const res = await fetchApi(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        success(
          isEditing
            ? `Producto "${formData.name}" actualizado con éxito`
            : `Producto "${formData.name}" creado con éxito`
        );
        setIsModalOpen(false);
        setEditingProduct(null);
        loadProducts();
      } else {
        error(res.message || 'Error al guardar el producto');
      }
    } catch (err: any) {
      error('Error de conexión al guardar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el producto "${productName}"?`)) {
      return;
    }

    setDeletingProductId(productId);
    try {
      const res = await fetchApi<any>(`/inventory/products/${productId}`, {
        method: 'DELETE',
      });

      if (res.success) {
        success(`Producto "${productName}" eliminado`);
        loadProducts();
      } else {
        error(res.message || 'No se pudo eliminar el producto');
      }
    } catch (err) {
      error('Error al eliminar el producto');
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) {
      warning('El nombre de la categoría o subcategoría es obligatorio');
      return;
    }

    setIsCategorySubmitting(true);
    try {
      const res = await fetchApi<any>('/inventory/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryFormData.name.trim(),
          description: categoryFormData.description.trim() || undefined,
          parentId: categoryFormData.parentId || undefined,
        }),
      });

      if (res.success && res.data) {
        const isSub = !!categoryFormData.parentId;
        success(
          isSub
            ? `Subcategoría "${res.data.name}" creada con éxito`
            : `Categoría "${res.data.name}" creada con éxito`
        );

        // Si el formulario de producto está abierto, sincronizar la selección
        if (isModalOpen) {
          if (isSub) {
            const rootPath = getCategoryPath(categoryFormData.parentId, categories);
            const rootNode = categories.find((c) => c.name === rootPath[0]);
            setFormData((prev) => ({
              ...prev,
              categoryId: rootNode ? rootNode.id : prev.categoryId,
              subcategoryId: res.data.id,
            }));
          } else {
            setFormData((prev) => ({
              ...prev,
              categoryId: res.data.id,
              subcategoryId: '',
            }));
          }
        }

        setCategoryFormData({ name: '', description: '', parentId: '' });
        loadProducts();
      } else {
        error(res.message || 'Error al guardar la categoría');
      }
    } catch (err: any) {
      error('Error de conexión al guardar la categoría');
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string, isSub = false) => {
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar la ${isSub ? 'subcategoría' : 'categoría'} "${catName}"?`
      )
    ) {
      return;
    }

    setDeletingCategoryId(catId);
    try {
      const res = await fetchApi<any>(`/inventory/categories/${catId}`, {
        method: 'DELETE',
      });

      if (res.success) {
        success(`${isSub ? 'Subcategoría' : 'Categoría'} "${catName}" eliminada`);
        if (formData.categoryId === catId) {
          setFormData((prev) => ({ ...prev, categoryId: '', subcategoryId: '' }));
        }
        if (formData.subcategoryId === catId) {
          setFormData((prev) => ({ ...prev, subcategoryId: '' }));
        }
        loadProducts();
      } else {
        error(res.message || 'No se pudo eliminar la categoría');
      }
    } catch (err: any) {
      error('Error de conexión al eliminar categoría');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'catalog' || activeTab === 'alerts') {
      exportToCsv<Product>('Inventario_Stock', products, [
        { header: 'SKU', key: 'sku' },
        { header: 'Código Barras', key: 'barcode' },
        { header: 'Nombre', key: 'name' },
        { header: 'Ubicación', key: 'location' },
        { header: 'Categoría Principal', key: 'category.name' },
        { header: 'Subcategoría', key: 'subcategory.name' },
        { header: 'Stock Actual', key: 'currentStock' },
        { header: 'Stock Mínimo', key: 'minStock' },
        { header: 'Precio Costo ($)', key: 'costPrice', format: (v) => Number(v).toFixed(2) },
        { header: 'Precio Venta ($)', key: 'salePrice', format: (v) => Number(v).toFixed(2) },
        { header: 'Alícuota IVA (%)', key: 'iva', format: (v) => `${Number(v ?? 21)}%` },
        {
          header: 'Proveedores',
          key: 'suppliers',
          format: (_, row) => (row.suppliers || []).map((s) => s.companyName).join(', ') || 'Sin proveedor',
        },
        {
          header: 'Valorización Costo ($)',
          key: 'costPrice',
          format: (_, row) => (Number(row.costPrice) * Number(row.currentStock)).toFixed(2),
        },
      ]);
      success('Listado de stock exportado a Excel.');
    } else {
      exportToCsv<StockMovement>('Movimientos_Kardex', movements, [
        { header: 'Código', key: 'code' },
        { header: 'Tipo', key: 'type' },
        { header: 'Referencia', key: 'reference' },
        { header: 'Fecha', key: 'createdAt', format: (v) => new Date(v).toLocaleString('es-AR') },
        { header: 'Usuario', key: 'user.fullName' },
        { header: 'Notas', key: 'notes' },
      ]);
      success('Movimientos de stock exportados a Excel.');
    }
  };

  // Cálculos de KPIs
  const totalStockUnits = products.reduce((acc, p) => acc + Number(p.currentStock), 0);
  const totalCostValuation = products.reduce((acc, p) => acc + Number(p.costPrice) * Number(p.currentStock), 0);
  const totalSaleValuation = products.reduce((acc, p) => acc + Number(p.salePrice) * Number(p.currentStock), 0);
  const criticalProducts = products.filter((p) => p.currentStock <= p.minStock);
  const criticalProductsCount = criticalProducts.length;

  // Mapeo para filtrado que incluye todos los descendientes
  const matchingCategoryNames = useMemo(() => {
    if (selectedCategory === 'ALL') return null;
    const target = categories.find((c) => c.name === selectedCategory);
    if (!target) return new Set([selectedCategory]);

    const names = new Set<string>([target.name]);
    const addDescendants = (catId: string) => {
      const children = categories.filter((c) => c.parentId === catId);
      for (const ch of children) {
        names.add(ch.name);
        addDescendants(ch.id);
      }
    };
    addDescendants(target.id);
    return names;
  }, [selectedCategory, categories]);

  // Filtros
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm)) ||
      (p.location && p.location.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesCategory = true;
    if (matchingCategoryNames) {
      const matchesMainCat = p.category && matchingCategoryNames.has(p.category.name);
      const matchesSubCat = p.subcategory && matchingCategoryNames.has(p.subcategory.name);
      matchesCategory = !!(matchesMainCat || matchesSubCat);
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Inventario y Stock</h1>
          <p className="text-sm text-slate-400">
            Control de existencias multidepósito, kárdex de movimientos y valorización contable
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {isAdmin && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 font-bold rounded-xl text-xs sm:text-sm border border-slate-700/80 shadow-md transition-all active:scale-[0.98]"
              title="Gestionar Categorías y Subcategorías (Solo Administradores)"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Categorías</span>
            </button>
          )}

          <Link
            href="/fabricacion"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-purple-400 hover:text-purple-300 font-bold rounded-xl text-xs sm:text-sm border border-slate-700/80 shadow-md transition-all active:scale-[0.98]"
            title="Ir a Fabricación, Recetas y Órdenes de Producción"
          >
            <Factory className="w-4 h-4" />
            <span>Fabricación</span>
          </Link>

          <button
            onClick={handleOpenCreateModal}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>

          <button
            onClick={handleExportExcel}
            title="Exportar a Excel"
            className="p-2 sm:p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={loadProducts}
            title="Recargar datos"
            className="p-2 sm:p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Carousel en Móvil, Grid en Escritorio */}
      <div className={`flex sm:grid sm:grid-cols-2 ${canSeeFinancials ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-3.5 sm:gap-4 overflow-x-auto snap-x snap-mandatory sm:overflow-visible pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar`}>
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl min-w-[260px] xs:min-w-[280px] sm:min-w-0 flex-shrink-0 snap-center sm:snap-align-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catálogo Total</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{products.length} SKU</div>
          <p className="text-xs text-slate-500 mt-1">{totalStockUnits.toLocaleString('es-AR')} unidades físicas</p>
        </div>

        {canSeeFinancials && (
          <>
            <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl min-w-[260px] xs:min-w-[280px] sm:min-w-0 flex-shrink-0 snap-center sm:snap-align-none">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valorización al Costo</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                ${totalCostValuation.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Capital invertido en stock</p>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl min-w-[260px] xs:min-w-[280px] sm:min-w-0 flex-shrink-0 snap-center sm:snap-align-none">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valorización de Venta</span>
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-400">
                ${totalSaleValuation.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Potencial bruto de comercialización</p>
            </div>
          </>
        )}

        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl min-w-[260px] xs:min-w-[280px] sm:min-w-0 flex-shrink-0 snap-center sm:snap-align-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alertas de Reposición</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400">{criticalProductsCount}</div>
          <p className="text-xs text-slate-500 mt-1">Artículos bajo stock mínimo</p>
        </div>
      </div>

      {/* Tabs & Filtros Responsivos */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar">
          {[
            { id: 'catalog', label: 'Catálogo', fullLabel: 'Catálogo de Artículos', icon: Package, count: products.length },
            { id: 'movements', label: 'Kárdex', fullLabel: 'Movimientos de Kárdex', icon: History, count: movements.length },
            { id: 'alerts', label: 'Alertas', fullLabel: 'Stock Crítico', icon: AlertTriangle, count: criticalProductsCount },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.fullLabel}</span>
                <span className="sm:hidden">{tab.label}</span>
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          {activeTab === 'catalog' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 w-full sm:max-w-[220px]"
            >
              <option value="ALL">Todas las Categorías</option>
              {flatCategoryTree.map((c) => (
                <option
                  key={c.item.id}
                  value={c.item.name}
                  className={c.depth === 0 ? 'font-bold text-white bg-slate-900' : 'text-slate-300 bg-slate-900'}
                >
                  {'\u00A0'.repeat(c.depth * 3)}
                  {c.depth === 0 ? '📁 ' : '↳ '}
                  {c.item.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por SKU, descripción..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Contenido */}
      {activeTab === 'catalog' && (
        <>
          {/* 1. Vista de Tarjetas para Móviles (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                No se encontraron productos
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isCritical = p.currentStock <= p.minStock;
                return (
                  <div
                    key={p.id}
                    className="p-4 bg-slate-900 border border-slate-800/90 rounded-2xl space-y-3 shadow-lg hover:border-slate-700 transition-colors"
                  >
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                          {p.sku}
                        </span>
                        {p.barcode && (
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700">
                            {p.barcode}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="w-3 h-3" /> Crítico
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Normal
                          </span>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title={`Editar ${p.name}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            disabled={deletingProductId === p.id}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title={`Eliminar ${p.name}`}
                          >
                            <Trash2 className={`w-4 h-4 ${deletingProductId === p.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Nombre y descripción */}
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">{p.name}</h3>
                      {p.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{p.description}</p>
                      )}
                    </div>

                    {/* Categoría, Subcategoría y Ubicación */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium border border-slate-700/80">
                        {p.category?.name || 'General'}
                      </span>
                      {p.subcategory?.name && (() => {
                        const path = getCategoryPath(p.subcategoryId || p.subcategory?.id, categories);
                        const subPath = path.length > 1 ? path.slice(1).join(' > ') : p.subcategory.name;
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-medium"
                            title={`Ruta completa: ${path.join(' > ')}`}
                          >
                            <CornerDownRight className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{subPath}</span>
                          </span>
                        );
                      })()}
                      {p.location && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium">
                          <MapPin className="w-3 h-3 text-amber-400" />
                          {p.location}
                        </span>
                      )}
                      {p.suppliers && p.suppliers.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium">
                          <Truck className="w-3 h-3 text-emerald-400" />
                          {p.suppliers[0].companyName}
                          {p.suppliers.length > 1 && ` (+${p.suppliers.length - 1})`}
                        </span>
                      )}
                    </div>

                    {/* Métricas: Stock y Precios */}
                    <div className="pt-2.5 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center bg-slate-950/50 -mx-4 -mb-4 p-3 rounded-b-2xl">
                      <div className="text-left pl-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock</div>
                        <div className={`text-sm font-black ${isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {p.currentStock} <span className="text-xs font-normal text-slate-400">{p.unit?.symbol || 'u.'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                          <span>P. Costo</span>
                          {canSeeFinancials && (
                            <button
                              type="button"
                              onClick={() => {
                                setPurchaseHistoryProductId(p.id);
                                setPurchaseHistoryProductName(p.name);
                              }}
                              className="text-sky-400 hover:text-sky-300"
                              title="Ver historial de compras"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-300">
                          {canSeeFinancials
                            ? `$${Number(p.costPrice).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
                            : '—'}
                        </div>
                      </div>

                      <div className="text-right pr-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">P. Venta</div>
                        <div className="text-xs font-bold text-white">
                          ${Number(p.salePrice).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 2. Vista de Tabla para Escritorio (hidden md:block) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
                  <tr>
                    <th className="p-4">SKU / Código</th>
                    <th className="p-4">Producto / Ubicación</th>
                    <th className="p-4">Categoría / Subcategoría</th>
                    <th className="p-4 text-right">P. Costo</th>
                    <th className="p-4 text-right">P. Venta</th>
                    <th className="p-4 text-center">Stock Actual</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No se encontraron productos
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isCritical = p.currentStock <= p.minStock;
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <div className="font-mono text-xs font-bold text-blue-400">{p.sku}</div>
                            {p.barcode && <div className="text-[10px] text-slate-500 font-mono">{p.barcode}</div>}
                            {p.supplierCode && (
                              <div className="text-[10px] text-purple-400 font-mono font-semibold" title="Código de Proveedor">
                                Prov: {p.supplierCode}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-white">{p.name}</div>
                            {p.description && <div className="text-xs text-slate-400 truncate max-w-xs">{p.description}</div>}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {p.location && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium">
                                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span>{p.location}</span>
                                </div>
                              )}
                              {p.suppliers && p.suppliers.length > 0 && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium" title={p.suppliers.map((s) => s.companyName).join(', ')}>
                                  <Truck className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="truncate max-w-[200px]">
                                    {p.suppliers.map((s) => s.companyName).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-xs text-slate-300">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-semibold text-slate-200">
                                {p.category?.name || 'General'}
                              </span>
                              {p.subcategory?.name && (() => {
                                const path = getCategoryPath(p.subcategoryId || p.subcategory?.id, categories);
                                const subPath = path.length > 1 ? path.slice(1).join(' > ') : p.subcategory.name;
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-medium"
                                    title={`Ruta completa: ${path.join(' > ')}`}
                                  >
                                    <CornerDownRight className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[200px]">{subPath}</span>
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="p-4 text-right text-xs text-slate-400">
                            {canSeeFinancials ? (
                              <div className="inline-flex items-center justify-end gap-1.5 font-mono">
                                <span>${Number(p.costPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPurchaseHistoryProductId(p.id);
                                    setPurchaseHistoryProductName(p.name);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                                  title="Ver historial de compras y variación de costo"
                                >
                                  <Info className="w-3.5 h-3.5 text-sky-400" />
                                </button>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="font-bold text-white">
                              ${Number(p.salePrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            <span className="inline-block text-[10px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded mt-0.5">
                              IVA {Number(p.iva ?? 21)}%
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`font-black text-sm ${
                                isCritical ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {p.currentStock} {p.unit?.symbol || 'u.'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {isCritical ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <AlertTriangle className="w-3 h-3" /> Crítico
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle className="w-3 h-3" /> Normal
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(p)}
                                className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
                                title={`Editar producto ${p.name}`}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  disabled={deletingProductId === p.id}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                                  title={`Eliminar producto ${p.name}`}
                                >
                                  <Trash2 className={`w-4 h-4 ${deletingProductId === p.id ? 'animate-spin' : ''}`} />
                                </button>
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
        </>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Artículos con necesidad inmediata de reposición</span>
            </div>
            <span className="text-xs text-amber-300 font-semibold">{criticalProducts.length} en alerta</span>
          </div>

          {/* Cards en móvil para Alertas */}
          <div className="p-3 space-y-2.5 md:hidden">
            {criticalProducts.length === 0 ? (
              <div className="p-6 text-center text-emerald-400 font-semibold text-xs">
                ¡Excelente! No hay productos con stock crítico.
              </div>
            ) : (
              criticalProducts.map((p) => (
                <div key={p.id} className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">{p.sku}</span>
                    <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                      Actual: {p.currentStock} u.
                    </span>
                  </div>
                  <div className="font-bold text-white text-sm">{p.name}</div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                    <span>Mín: {p.minStock} | Ideal: {p.idealStock}</span>
                    <span className="text-amber-400 font-bold">Déficit: +{Math.max(0, p.idealStock - p.currentStock)} u.</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tabla de escritorio para Alertas */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Producto</th>
                  <th className="p-4 text-center">Stock Actual</th>
                  <th className="p-4 text-center">Stock Mínimo</th>
                  <th className="p-4 text-center">Stock Ideal</th>
                  <th className="p-4 text-right">Déficit sugerido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {criticalProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-emerald-400 font-semibold">
                      ¡Excelente! No hay productos con stock por debajo del mínimo.
                    </td>
                  </tr>
                ) : (
                  criticalProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-amber-400">{p.sku}</td>
                      <td className="p-4 font-bold text-white">{p.name}</td>
                      <td className="p-4 text-center font-black text-rose-400">{p.currentStock}</td>
                      <td className="p-4 text-center font-semibold text-slate-400">{p.minStock}</td>
                      <td className="p-4 text-center font-semibold text-slate-400">{p.idealStock}</td>
                      <td className="p-4 text-right font-black text-amber-400">
                        +{Math.max(0, p.idealStock - p.currentStock)} unidades
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Cards en móvil para Movimientos */}
          <div className="p-3 space-y-2.5 md:hidden">
            {movements.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No hay movimientos de kárdex registrados
              </div>
            ) : (
              movements.map((mov) => {
                const isEntry = mov.type.startsWith('ENTRADA') || mov.type.startsWith('AJUSTE_POSITIVO');
                return (
                  <div key={mov.id} className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-400">{mov.code}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isEntry
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isEntry ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {mov.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-white">
                      {mov.items?.map((it, idx) => (
                        <div key={idx}>
                          <span className="font-bold">{it.product?.name || 'Ítem'}</span>: {it.quantity} u.
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>{new Date(mov.createdAt).toLocaleDateString('es-AR')}</span>
                      <span>Ref: {mov.reference || '-'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tabla de escritorio para Movimientos */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">Código</th>
                  <th className="p-4">Tipo Movimiento</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Referencia</th>
                  <th className="p-4">Operador</th>
                  <th className="p-4">Detalle Ítems</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No hay movimientos de kárdex registrados
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => {
                    const isEntry = mov.type.startsWith('ENTRADA') || mov.type.startsWith('AJUSTE_POSITIVO');
                    return (
                      <tr key={mov.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono text-xs font-bold text-blue-400">{mov.code}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isEntry
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {isEntry ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            {mov.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-300">{new Date(mov.createdAt).toLocaleString('es-AR')}</td>
                        <td className="p-4 text-xs font-semibold text-slate-300">{mov.reference || '-'}</td>
                        <td className="p-4 text-xs text-slate-400">{mov.user?.fullName || 'Sistema'}</td>
                        <td className="p-4 text-xs text-slate-300">
                          {mov.items?.map((it, idx) => (
                            <div key={idx}>
                              <span className="font-bold text-white">{it.product?.name || 'Ítem'}</span>: {it.quantity} u.
                            </div>
                          ))}
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

      {/* Botón Flotante de Acción Principal (FAB) en Móviles */}
      <button
        onClick={handleOpenCreateModal}
        className="sm:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-2xl shadow-blue-500/50 active:scale-90 transition-all border-2 border-blue-400/30"
        title="Crear Nuevo Producto"
        aria-label="Crear Nuevo Producto"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Modal Nuevo / Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  {editingProduct ? <Edit3 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingProduct ? 'Editar Producto / Artículo' : 'Nuevo Producto / Artículo'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingProduct
                      ? `Modificando ${editingProduct.sku} - ${editingProduct.name}`
                      : 'Completa las especificaciones, valores y stock del producto'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Formulario con scroll independiente y espaciado mejorado */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 1. SECCIÓN: Información Principal */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-700/50">
                  <Tag className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    1. Información Principal
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-400" />
                      <span>SKU <span className="text-rose-400 font-bold">*</span></span>
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="Ej. ART-0012"
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-purple-400" />
                      <span>Cód. Proveedor</span>
                    </label>
                    <input
                      type="text"
                      value={formData.supplierCode}
                      onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
                      placeholder="Ej. PROV-ART-88"
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-sky-400" />
                        <span>Código de Barras</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="Ej. 7791234567890"
                        className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setIsBarcodeScannerOpen(true)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 rounded-lg border border-sky-500/30 transition-all"
                        title="Escanear con la cámara del celular"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nombre del Producto <span className="text-rose-400 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. Tapa de Cilindro Reforzada"
                    className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-amber-400" />
                        <span>Categoría Principal</span>
                      </label>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFormData({ name: '', description: '', parentId: '' });
                            setIsCategoryModalOpen(true);
                          }}
                          className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition-colors"
                          title="Crear nueva categoría principal"
                        >
                          <Plus className="w-3 h-3" />
                          Nueva
                        </button>
                      )}
                    </div>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => {
                        const newCatId = e.target.value;
                        setFormData({ ...formData, categoryId: newCatId, subcategoryId: '' });
                      }}
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    >
                      <option value="">Seleccionar Categoría...</option>
                      {mainCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          📁 {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FolderTree className="w-3.5 h-3.5 text-teal-400" />
                        <span>Subcategoría (Opcional)</span>
                      </label>
                      {isAdmin && formData.categoryId && (
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFormData({
                              name: '',
                              description: '',
                              parentId: formData.subcategoryId || formData.categoryId,
                            });
                            setIsCategoryModalOpen(true);
                          }}
                          className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition-colors"
                          title="Crear nueva subcategoría en esta categoría"
                        >
                          <Plus className="w-3 h-3" />
                          Nueva Sub
                        </button>
                      )}
                    </div>
                    <select
                      value={formData.subcategoryId}
                      disabled={!formData.categoryId || availableSubcategories.length === 0}
                      onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!formData.categoryId
                          ? 'Primero elija categoría...'
                          : availableSubcategories.length === 0
                          ? 'Sin subcategorías creadas'
                          : 'Sin subcategoría (General)'}
                      </option>
                      {availableSubcategories.map((sc) => (
                        <option key={sc.item.id} value={sc.item.id}>
                          {'\u00A0'.repeat(sc.depth * 2)}↳ {sc.item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Descripción (Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalles técnicos, aplicación, notas..."
                    className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* 2. SECCIÓN: Precios, Markup e Impuestos (Oculto para operarios de stock) */}
              {!canSeeFinancials ? (
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex items-center gap-3 text-slate-400 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Tu rol (Operador de Stock) no tiene permisos para visualizar ni modificar costos, márgenes o precios de venta.</span>
                </div>
              ) : (
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-700/50">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      2. Estructura de Precios, Markup & Rentabilidad
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Precio Costo</span>
                        </span>
                        {editingProduct && (
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseHistoryProductId(editingProduct.id);
                              setPurchaseHistoryProductName(editingProduct.name);
                            }}
                            className="p-1 rounded text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                            title="Ver historial de compras del producto"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold pointer-events-none">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={formData.costPrice}
                          onChange={(e) => handleCostChange(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-amber-400" />
                        <span>Markup (%)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold pointer-events-none">%</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={formData.markup}
                          onChange={(e) => handleMarkupChange(e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                        <span>Precio Venta</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold pointer-events-none">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={formData.salePrice}
                          onChange={(e) => handleSalePriceChange(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-purple-400" />
                          <span>Alícuota IVA</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                          {formData.iva}%
                        </span>
                      </label>
                      <select
                        value={formData.iva}
                        onChange={(e) => setFormData({ ...formData, iva: e.target.value })}
                        className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-semibold transition-all"
                      >
                        <option value="21">21% (General)</option>
                        <option value="10.5">10.5% (Reducido)</option>
                        <option value="27">27% (Incrementado)</option>
                        <option value="0">0% (Exento / No Gravado)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. SECCIÓN: Gestión de Stock y Ubicación */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-700/50">
                  <Boxes className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    3. Gestión de Stock y Ubicación
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{editingProduct ? 'Stock Actual' : 'Stock Inicial'}</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.initialStock}
                      disabled={!!editingProduct}
                      onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                      placeholder="0"
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                    />
                    {editingProduct && (
                      <span className="text-[11px] text-slate-400 block mt-1">
                        El stock físico se modifica mediante Kárdex o Fabricación.
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span>Ubicación en Depósito</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Ej. Pasillo 2 - Estante B3"
                        className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Stock Mínimo (Alerta)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      placeholder="Ej. 5"
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Stock Ideal (Objetivo)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.idealStock}
                      onChange={(e) => setFormData({ ...formData, idealStock: e.target.value })}
                      placeholder="Ej. 20"
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 4. SECCIÓN: Proveedores Asociados */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      4. Proveedores Asociados ({formData.supplierIds.length})
                    </h4>
                  </div>
                  {formData.supplierIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, supplierIds: [] })}
                      className="text-[11px] text-slate-400 hover:text-rose-400 underline transition-colors"
                    >
                      Quitar todos
                    </button>
                  )}
                </div>

                {/* Proveedores seleccionados como Tags / Pills */}
                {formData.supplierIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                    {formData.supplierIds.map((suppId) => {
                      const supp = suppliers.find((s) => s.id === suppId);
                      return (
                        <span
                          key={suppId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm"
                        >
                          <Building className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{supp ? (supp.code ? `[${supp.code}] ${supp.companyName}` : supp.companyName) : 'Proveedor'}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                supplierIds: formData.supplierIds.filter((id) => id !== suppId),
                              })
                            }
                            className="p-0.5 ml-1 text-emerald-400 hover:text-white hover:bg-emerald-500/30 rounded-md transition-colors"
                            title="Quitar este proveedor"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Sin proveedores asignados actualmente. Selecciona proveedores habituales abajo:
                  </p>
                )}

                {/* Selector Dropdown para vincular proveedor */}
                <div>
                  <select
                    value=""
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (selectedId && !formData.supplierIds.includes(selectedId)) {
                        setFormData({
                          ...formData,
                          supplierIds: [...formData.supplierIds, selectedId],
                        });
                      }
                    }}
                    className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  >
                    <option value="">
                      {suppliers.length === 0
                        ? 'No hay proveedores registrados aún en Compras'
                        : '+ Seleccionar y vincular proveedor...'}
                    </option>
                    {suppliers
                      .filter((s) => !formData.supplierIds.includes(s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code ? `[${s.code}] ` : ''}{s.companyName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : editingProduct ? (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Crear Producto</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gestión de Categorías y Subcategorías (Sólo ADMIN) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Gestión de Categorías y Subcategorías</h3>
                  <p className="text-xs text-slate-400">
                    {isAdmin
                      ? 'Crea categorías principales y subcategorías para organizar el inventario'
                      : 'Listado de clasificaciones registradas'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Formulario Nueva Categoría / Subcategoría */}
              {isAdmin ? (
                <form
                  onSubmit={handleCreateCategory}
                  className="p-4 bg-slate-800/60 border border-slate-700/70 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        {categoryFormData.parentId ? 'Nueva Subcategoría' : 'Nueva Categoría'}
                      </span>
                    </div>

                    {categoryFormData.parentId && (
                      <button
                        type="button"
                        onClick={() => setCategoryFormData({ ...categoryFormData, parentId: '' })}
                        className="text-[11px] text-slate-400 hover:text-white underline transition-colors"
                      >
                        Crear como Categoría Principal
                      </button>
                    )}
                  </div>

                  {categoryFormData.parentId && (() => {
                    const parentPath = getCategoryPath(categoryFormData.parentId, categories).join(' > ');
                    return (
                      <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-sky-300 min-w-0">
                          <FolderTree className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                          <span className="truncate">
                            Creando dentro de: <strong className="text-white font-bold">{parentPath}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCategoryFormData({ ...categoryFormData, parentId: '' })}
                          className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0 ml-2"
                        >
                          ✕ Quitar
                        </button>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      ¿Es Subcategoría de otra? (Categoría o Subcategoría Padre)
                    </label>
                    <select
                      value={categoryFormData.parentId}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, parentId: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Ninguna (Es Categoría Principal)</option>
                      {flatCategoryTree.map((c) => (
                        <option key={c.item.id} value={c.item.id}>
                          {'\u00A0'.repeat(c.depth * 3)}
                          {c.depth === 0 ? '📁 ' : '↳ '}
                          {c.item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {categoryFormData.parentId ? 'Nombre de la Subcategoría *' : 'Nombre de la Categoría *'}
                    </label>
                    <input
                      type="text"
                      value={categoryFormData.name}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, name: e.target.value })
                      }
                      placeholder={
                        categoryFormData.parentId
                          ? 'Ej. Filtros de Aceite, Pistones, Inalámbricos...'
                          : 'Ej. Filtros y Aceites, Frenos, Iluminación...'
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Descripción (Opcional)
                    </label>
                    <input
                      type="text"
                      value={categoryFormData.description}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, description: e.target.value })
                      }
                      placeholder="Breve descripción o tipos de artículos que incluye..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isCategorySubmitting || !categoryFormData.name.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 transition-all active:scale-[0.98]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {isCategorySubmitting
                        ? 'Guardando...'
                        : categoryFormData.parentId
                        ? 'Agregar Subcategoría'
                        : 'Agregar Categoría'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Solo los usuarios con rol Administrador pueden crear o eliminar categorías.</span>
                </div>
              )}

              {/* Lista Jerárquica de Categorías Existentes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Categorías y Subcategorías ({mainCategories.length} principales)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {categories.reduce(
                      (acc, c) => acc + (c._count?.products || 0) + (c._count?.subProducts || 0),
                      0
                    )}{' '}
                    productos vinculados
                  </span>
                </div>

                {mainCategories.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm bg-slate-800/30 rounded-xl border border-slate-800">
                    No hay categorías registradas aún. {isAdmin && '¡Crea la primera arriba!'}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {categoryTree.map((rootCat) => {
                      const renderNode = (cat: CategoryItem, depth: number): React.ReactNode => {
                        const children = cat.children || [];
                        const totalProducts = getTotalCategoryProducts(cat);
                        const totalDescendants = countTotalDescendants(cat);
                        const isDeleting = deletingCategoryId === cat.id;

                        if (depth === 0) {
                          return (
                            <div
                              key={cat.id}
                              className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3 space-y-2.5 transition-colors hover:border-slate-700/80"
                            >
                              {/* Categoría Principal */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <Folder className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                                      <span>{cat.name}</span>
                                      {children.length > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                                          {totalDescendants} {totalDescendants === 1 ? 'subcat.' : 'subcats.'}
                                        </span>
                                      )}
                                    </div>
                                    {cat.description && (
                                      <div className="text-xs text-slate-400 truncate max-w-xs">
                                        {cat.description}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                    {totalProducts} {totalProducts === 1 ? 'producto' : 'productos'}
                                  </span>

                                  {isAdmin && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCategoryFormData({
                                            name: '',
                                            description: '',
                                            parentId: cat.id,
                                          })
                                        }
                                        title="Añadir subcategoría a esta categoría"
                                        className="p-1.5 rounded-lg border border-sky-500/20 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/40 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span className="hidden sm:inline">Subcategoría</span>
                                      </button>

                                      <button
                                        onClick={() => handleDeleteCategory(cat.id, cat.name, false)}
                                        disabled={totalProducts > 0 || isDeleting}
                                        title={
                                          totalProducts > 0
                                            ? 'No se puede eliminar porque contiene productos o subcategorías con productos'
                                            : 'Eliminar categoría'
                                        }
                                        className={`p-1.5 rounded-lg border transition-colors ${
                                          totalProducts > 0
                                            ? 'opacity-30 border-transparent text-slate-500 cursor-not-allowed'
                                            : 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40'
                                        }`}
                                      >
                                        <Trash2
                                          className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`}
                                        />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Subcategorías anidadas recursivas */}
                              {children.length > 0 && (
                                <div className="pl-3 sm:pl-4 pt-1 space-y-1.5 border-l-2 border-slate-700/50 ml-2">
                                  {children.map((child) => renderNode(child, depth + 1))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Subcategorías de nivel anidado (depth > 0)
                        return (
                          <div key={cat.id} className="space-y-1.5">
                            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:bg-slate-900 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <CornerDownRight className="w-3.5 h-3.5 text-sky-400/70 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 flex-wrap truncate">
                                    <span className="truncate">{cat.name}</span>
                                    {children.length > 0 && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                                        {children.length} subcat.
                                      </span>
                                    )}
                                  </div>
                                  {cat.description && (
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {cat.description}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/60">
                                  {totalProducts} prod.
                                </span>

                                {isAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCategoryFormData({
                                          name: '',
                                          description: '',
                                          parentId: cat.id,
                                        })
                                      }
                                      title={`Añadir subcategoría a "${cat.name}"`}
                                      className="p-1 rounded-md border border-sky-500/20 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/40 transition-colors flex items-center gap-0.5 text-[10px] font-semibold"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                      <span>Sub</span>
                                    </button>

                                    <button
                                      onClick={() => handleDeleteCategory(cat.id, cat.name, true)}
                                      disabled={totalProducts > 0 || isDeleting}
                                      title={
                                        totalProducts > 0
                                          ? 'No se puede eliminar porque contiene productos o subcategorías con productos'
                                          : 'Eliminar subcategoría'
                                      }
                                      className={`p-1 rounded-md border transition-colors ${
                                        totalProducts > 0
                                          ? 'opacity-30 border-transparent text-slate-500 cursor-not-allowed'
                                          : 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40'
                                      }`}
                                    >
                                      <Trash2
                                        className={`w-3 h-3 ${isDeleting ? 'animate-spin' : ''}`}
                                      />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Subcategorías más profundas recursivas */}
                            {children.length > 0 && (
                              <div className="pl-3 sm:pl-4 pt-1 space-y-1.5 border-l-2 border-slate-700/40 ml-2">
                                {children.map((child) => renderNode(child, depth + 1))}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return renderNode(rootCat, 0);
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Escáner de Código de Barras con Cámara */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScan={(scannedCode) => {
          setFormData((prev) => ({ ...prev, barcode: scannedCode }));
          success(`Código escaneado: ${scannedCode}`);
        }}
      />

      {/* Modal de Historial de Compras de Producto */}
      <ProductPurchaseHistoryModal
        isOpen={!!purchaseHistoryProductId}
        productId={purchaseHistoryProductId}
        productName={purchaseHistoryProductName}
        onClose={() => {
          setPurchaseHistoryProductId(null);
          setPurchaseHistoryProductName('');
        }}
      />
    </div>
  );
}
