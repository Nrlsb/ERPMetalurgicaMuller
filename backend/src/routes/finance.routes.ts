import { Router } from 'express';
import {
  getCashRegisters,
  openCashRegister,
  closeCashRegister,
  getCashMovements,
  createCashMovement,
  getExpenses,
  getExpenseCategories,
  createExpense,
  getBankAccounts,
  createBankAccount,
  createBankTransaction,
  getChecks,
  createCheck,
  updateCheck,
  changeCheckStatus,
  deleteCheck,
} from '../controllers/finance.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Cajas
router.get('/cash-registers', getCashRegisters);
router.post('/cash-registers/:id/open', authorizeRoles('ADMIN', 'FINANZAS', 'VENTAS', 'OPERADOR'), openCashRegister);
router.post('/cash-registers/:id/close', authorizeRoles('ADMIN', 'FINANZAS', 'VENTAS', 'OPERADOR'), closeCashRegister);

// Movimientos de Caja
router.get('/cash-movements', getCashMovements);
router.post('/cash-movements', authorizeRoles('ADMIN', 'FINANZAS', 'VENTAS'), createCashMovement);

// Gastos
router.get('/expenses', getExpenses);
router.get('/expenses/categories', getExpenseCategories);
router.post('/expenses', authorizeRoles('ADMIN', 'FINANZAS'), createExpense);

// Bancos
router.get('/bank-accounts', getBankAccounts);
router.post('/bank-accounts', authorizeRoles('ADMIN', 'FINANZAS'), createBankAccount);
router.post('/bank-transactions', authorizeRoles('ADMIN', 'FINANZAS'), createBankTransaction);

// Cheques & Cartera
router.get('/checks', authorizeRoles('ADMIN', 'FINANZAS', 'VENTAS'), getChecks);
router.post('/checks', authorizeRoles('ADMIN', 'FINANZAS', 'VENTAS'), createCheck);
router.put('/checks/:id', authorizeRoles('ADMIN', 'FINANZAS'), updateCheck);
router.patch('/checks/:id/status', authorizeRoles('ADMIN', 'FINANZAS'), changeCheckStatus);
router.delete('/checks/:id', authorizeRoles('ADMIN', 'FINANZAS'), deleteCheck);

export default router;
