import { Router } from 'express';
import {
  getRecipes,
  getRecipeByProductId,
  createOrUpdateRecipe,
  deleteRecipe,
  getProductionOrders,
  createProductionOrder,
  completeProductionOrder,
  cancelProductionOrder,
} from '../controllers/production.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Recetas (BOM)
router.get('/recipes', getRecipes);
router.get('/recipes/product/:productId', getRecipeByProductId);
router.post('/recipes', authorizeRoles('ADMIN', 'OPERADOR'), createOrUpdateRecipe);
router.delete('/recipes/:id', authorizeRoles('ADMIN'), deleteRecipe);

// Órdenes de Fabricación
router.get('/orders', getProductionOrders);
router.post('/orders', authorizeRoles('ADMIN', 'OPERADOR'), createProductionOrder);
router.post('/orders/:id/complete', authorizeRoles('ADMIN', 'OPERADOR'), completeProductionOrder);
router.post('/orders/:id/cancel', authorizeRoles('ADMIN', 'OPERADOR'), cancelProductionOrder);

export default router;
