import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  // 1. Verificar cabecera Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Si no viene en la cabecera, verificar cookie 'token' (HttpOnly)
  if (!token && (req as any).cookies && (req as any).cookies.token) {
    token = (req as any).cookies.token;
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Acceso no autorizado. Sesión no encontrada o token no provisto.' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Sesión expirada o token inválido.' });
    return;
  }
}

export function authorizeRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado.' });
      return;
    }

    if (req.user.role === 'ADMIN' || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: 'No tienes los permisos requeridos para acceder a este recurso.',
    });
  };
}

export function requirePermission(permissionCode: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado.' });
      return;
    }

    if (req.user.role === 'ADMIN') {
      next();
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (!user || !user.isActive) {
        res.status(403).json({ success: false, message: 'Usuario no activo o no encontrado.' });
        return;
      }

      const hasPerm = user.role.permissions.some(
        (rp) => rp.permission.code === permissionCode
      );

      if (hasPerm) {
        next();
        return;
      }

      res.status(403).json({
        success: false,
        message: `Permiso denegado (${permissionCode}).`,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al verificar permisos.' });
    }
  };
}
