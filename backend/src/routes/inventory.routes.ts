import { Router } from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getStockAlerts,
  getStockMovements,
  adjustStock,
} from '../controllers/inventory.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/products', getProducts);
router.post('/products', authorizeRoles('ADMIN', 'OPERADOR', 'COMPRAS'), createProduct);
router.put('/products/:id', authorizeRoles('ADMIN', 'OPERADOR'), updateProduct);
router.delete('/products/:id', authorizeRoles('ADMIN'), deleteProduct);
router.post('/adjust', authorizeRoles('ADMIN', 'OPERADOR'), adjustStock);

router.get('/categories', getCategories);
router.post('/categories', authorizeRoles('ADMIN'), createCategory);
router.put('/categories/:id', authorizeRoles('ADMIN'), updateCategory);
router.delete('/categories/:id', authorizeRoles('ADMIN'), deleteCategory);

router.get('/alerts', getStockAlerts);
router.get('/movements', getStockMovements);

export default router;
