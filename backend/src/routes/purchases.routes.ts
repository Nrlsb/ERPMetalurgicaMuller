import { Router } from 'express';
import {
  getSuppliers,
  createSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  getPurchaseInvoices,
  createPurchaseInvoice,
  getPayables,
  registerSupplierPayment,
} from '../controllers/purchases.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Proveedores
router.get('/suppliers', getSuppliers);
router.post('/suppliers', authorizeRoles('ADMIN', 'COMPRAS', 'OPERADOR'), createSupplier);

// Órdenes de Compra
router.get('/orders', getPurchaseOrders);
router.post('/orders', authorizeRoles('ADMIN', 'COMPRAS'), createPurchaseOrder);

// Facturas de Compra & Recepciones
router.get('/invoices', getPurchaseInvoices);
router.post('/invoices', authorizeRoles('ADMIN', 'COMPRAS', 'OPERADOR'), createPurchaseInvoice);

// Cuentas por Pagar & Pagos
router.get('/payables', getPayables);
router.post('/payments', authorizeRoles('ADMIN', 'COMPRAS', 'FINANZAS'), registerSupplierPayment);

export default router;
