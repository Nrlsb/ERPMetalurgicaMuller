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

export default router;
