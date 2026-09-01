import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getInvoices,
  createInvoice,
  getQuotes,
  createQuote,
  updateQuoteStatus,
  getReceivables,
  registerPayment,
} from '../controllers/sales.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de ventas requieren autenticación
router.use(authenticate);

// Clientes
router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomerById);
router.post('/customers', authorizeRoles('ADMIN', 'VENTAS', 'OPERADOR'), createCustomer);
router.put('/customers/:id', authorizeRoles('ADMIN', 'VENTAS'), updateCustomer);

// Facturas y Ventas
router.get('/invoices', getInvoices);
router.post('/invoices', authorizeRoles('ADMIN', 'VENTAS'), createInvoice);

// Cotizaciones
router.get('/quotes', getQuotes);
router.post('/quotes', authorizeRoles('ADMIN', 'VENTAS'), createQuote);
router.patch('/quotes/:id/status', authorizeRoles('ADMIN', 'VENTAS'), updateQuoteStatus);

// Cuentas por Cobrar & Pagos
router.get('/receivables', getReceivables);
router.post('/payments', authorizeRoles('ADMIN', 'VENTAS', 'FINANZAS'), registerPayment);

export default router;
