import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import dashboardRoutes from './dashboard.routes';
import inventoryRoutes from './inventory.routes';
import productionRoutes from './production.routes';
import salesRoutes from './sales.routes';
import purchasesRoutes from './purchases.routes';
import financeRoutes from './finance.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/production', productionRoutes);
router.use('/sales', salesRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/finance', financeRoutes);

// Healthcheck
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'ERP Muller API',
    timestamp: new Date().toISOString(),
  });
});

export default router;
