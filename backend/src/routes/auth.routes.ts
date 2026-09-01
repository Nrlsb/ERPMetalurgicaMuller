import { Router } from 'express';
import {
  login,
  getMe,
  changePassword,
  setup2FA,
  enable2FA,
  disable2FA,
  verifyLogin2FA,
  logout,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/security.middleware';

const router = Router();

// Rutas públicas con limitador estricto de fuerza bruta
router.post('/login', authLimiter, login);
router.post('/2fa/verify-login', authLimiter, verifyLogin2FA);

// Rutas protegidas que requieren autenticación
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.post('/logout', authenticate, logout);

// Rutas de configuración de Autenticación de Dos Factores (2FA)
router.post('/2fa/setup', authenticate, setup2FA);
router.post('/2fa/enable', authenticate, enable2FA);
router.post('/2fa/disable', authenticate, disable2FA);

export default router;
