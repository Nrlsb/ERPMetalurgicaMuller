import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logSecurityEvent } from '../lib/audit';
import { strongPasswordRegex, strongPasswordMessage } from './auth.controller';

const createUserSchema = z.object({
  email: z.string().min(2, 'Usuario o email requerido'),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  password: z.string().min(8, 'Mínimo 8 caracteres').regex(strongPasswordRegex, strongPasswordMessage),
  phone: z.string().optional(),
  roleId: z.string().min(1, 'ID de rol requerido'),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).regex(strongPasswordRegex, strongPasswordMessage).optional(),
});

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        twoFactorEnabled: true,
        failedAttempts: true,
        lockedUntil: true,
        lastLogin: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        twoFactorEnabled: true,
        failedAttempts: true,
        lockedUntil: true,
        lastLogin: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: {
              select: {
                permission: {
                  select: { id: true, code: true, name: true, module: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado' });
      return;
    }

    // Buscar rol por ID o por Nombre (para soportar tanto UUID como nombres de rol)
    let role = await prisma.role.findFirst({
      where: {
        OR: [
          { id: data.roleId },
          { name: data.roleId },
        ],
      },
    });

    if (!role) {
      res.status(400).json({ success: false, message: 'El rol de seguridad seleccionado no es válido' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        passwordHash,
        roleId: role.id,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: { select: { id: true, name: true } },
      },
    });

    await logSecurityEvent({
      userId: req.user?.userId,
      action: 'CREATE_USER',
      module: 'USUARIOS',
      entityId: user.id,
      details: { email: user.email, role: user.role.name },
      req,
    });

    res.status(201).json({ success: true, message: 'Usuario creado exitosamente', data: user });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const updatePayload: any = {};
    if (data.fullName) updatePayload.fullName = data.fullName;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.roleId) {
      const role = await prisma.role.findFirst({
        where: {
          OR: [
            { id: data.roleId },
            { name: data.roleId },
          ],
        },
      });
      if (role) {
        updatePayload.roleId = role.id;
      }
    }
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updatePayload.passwordHash = await bcrypt.hash(data.password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        isActive: true,
        role: { select: { id: true, name: true } },
      },
    });

    await logSecurityEvent({
      userId: req.user?.userId,
      action: 'UPDATE_USER',
      module: 'USUARIOS',
      entityId: id,
      details: { changes: Object.keys(data) },
      req,
    });

    res.json({ success: true, message: 'Usuario actualizado exitosamente', data: updatedUser });
  } catch (error) {
    next(error);
  }
}

export async function unlockUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
      select: { id: true, email: true, fullName: true },
    });

    await logSecurityEvent({
      userId: req.user?.userId,
      action: 'ADMIN_UNLOCK_USER',
      module: 'USUARIOS',
      entityId: id,
      details: { unlockedEmail: user.email },
      req,
    });

    res.json({ success: true, message: `Cuenta de ${user.fullName} desbloqueada exitosamente.` });
  } catch (error) {
    next(error);
  }
}

export async function getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
}

export async function getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' },
    });

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
}

// Obtener Registro de Auditoría de Seguridad
export async function getAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const logs = await prisma.auditLog.findMany({
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    const total = await prisma.auditLog.count();

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}
