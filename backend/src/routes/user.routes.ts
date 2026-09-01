import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  getRoles,
  getPermissions,
  unlockUser,
  getAuditLogs,
} from '../controllers/user.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de usuarios requieren autenticación
router.use(authenticate);

// Listado de usuarios
router.get('/', authorizeRoles('ADMIN', 'SUPERVISOR'), getUsers);

// Auditoría del sistema (Solo Administradores)
router.get('/audit-logs', authorizeRoles('ADMIN'), getAuditLogs);

// Gestión de roles y permisos
router.get('/roles', authorizeRoles('ADMIN'), getRoles);
router.get('/permissions', authorizeRoles('ADMIN'), getPermissions);

// Operaciones individuales sobre usuarios
router.get('/:id', authorizeRoles('ADMIN'), getUserById);
router.post('/', authorizeRoles('ADMIN'), createUser);
router.patch('/:id', authorizeRoles('ADMIN'), updateUser);
router.post('/:id/unlock', authorizeRoles('ADMIN'), unlockUser);

export default router;
