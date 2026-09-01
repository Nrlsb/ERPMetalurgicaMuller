import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/jwt';
import { config } from '../config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logSecurityEvent } from '../lib/audit';

// Regla de Contraseña Robusta (Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo)
export const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
export const strongPasswordMessage =
  'La contraseña debe tener al menos 8 caracteres e incluir al menos una mayúscula, una minúscula, un número y un símbolo especial (!@#$%^&*).';

const loginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  identifier: z.string().optional(),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres').regex(strongPasswordRegex, strongPasswordMessage),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.parse(req.body);
    const identifier = (parsed.identifier || parsed.username || parsed.email || '').trim();

    if (!identifier) {
      res.status(400).json({ success: false, message: 'Debe ingresar el usuario o correo electrónico' });
      return;
    }

    const password = parsed.password;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { fullName: { equals: identifier, mode: 'insensitive' } },
        ],
      },
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

    if (!user) {
      // Registrar intento con usuario/correo inexistente
      await logSecurityEvent({
        action: 'LOGIN_FAILED_UNKNOWN_USER',
        module: 'AUTH',
        details: { loginAttempt: identifier },
        req,
      });
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      return;
    }

    if (!user.isActive) {
      await logSecurityEvent({
        userId: user.id,
        action: 'LOGIN_BLOCKED_INACTIVE_USER',
        module: 'AUTH',
        req,
      });
      res.status(403).json({ success: false, message: 'La cuenta de usuario está desactivada. Contacte al administrador.' });
      return;
    }

    // 1. Verificar si la cuenta se encuentra bloqueada temporalmente
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      await logSecurityEvent({
        userId: user.id,
        action: 'LOGIN_BLOCKED_LOCKED_ACCOUNT',
        module: 'AUTH',
        details: { minutesLeft },
        req,
      });
      res.status(423).json({
        success: false,
        message: `Cuenta bloqueada temporalmente por exceso de intentos fallidos. Intente nuevamente en ${minutesLeft} minuto(s).`,
      });
      return;
    }

    // 2. Verificar contraseña con Bcrypt
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      const failedAttempts = (user.failedAttempts || 0) + 1;
      const MAX_ATTEMPTS = 5;

      if (failedAttempts >= MAX_ATTEMPTS) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts,
            lockedUntil: lockoutTime,
          },
        });

        await logSecurityEvent({
          userId: user.id,
          action: 'ACCOUNT_LOCKED',
          module: 'AUTH',
          details: { reason: '5 intentos fallidos consecutivos', lockoutDurationMinutes: 15 },
          req,
        });

        res.status(423).json({
          success: false,
          message: 'Has alcanzado el límite de 5 intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por 15 minutos por seguridad.',
        });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts },
      });

      await logSecurityEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        module: 'AUTH',
        details: { failedAttempts, remainingAttempts: MAX_ATTEMPTS - failedAttempts },
        req,
      });

      res.status(401).json({
        success: false,
        message: `Credenciales inválidas. Intentos restantes antes del bloqueo: ${MAX_ATTEMPTS - failedAttempts}`,
      });
      return;
    }

    // 3. Si la contraseña es correcta, reiniciar contador de intentos fallidos y bloqueo
    if (user.failedAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    // 4. Si el usuario tiene 2FA activado, requerir código de segundo factor
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = jwt.sign(
        { tempUserId: user.id, action: '2fa_login_challenge' },
        config.jwt.secret,
        { expiresIn: '5m' as any }
      );

      await logSecurityEvent({
        userId: user.id,
        action: '2FA_CHALLENGE_REQUESTED',
        module: 'AUTH',
        req,
      });

      res.json({
        success: true,
        requires2FA: true,
        tempToken,
        message: 'Se requiere verificación de segundo factor (2FA). Ingrese el código de su aplicación autenticadora.',
      });
      return;
    }

    // 5. Flujo normal de login sin 2FA: Actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), failedAttempts: 0, lockedUntil: null },
    });

    // Registrar log de auditoría
    await logSecurityEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      module: 'AUTH',
      req,
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role.name,
      fullName: user.fullName,
    });

    // Establecer Cookie HttpOnly segura
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role.name,
          permissions,
          twoFactorEnabled: user.twoFactorEnabled,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// Verificación de Segundo Factor durante el Login
export async function verifyLogin2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      res.status(400).json({ success: false, message: 'Token temporal y código 2FA requeridos.' });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, config.jwt.secret);
    } catch (e) {
      res.status(401).json({ success: false, message: 'La sesión temporal de 2FA ha expirado. Inicie sesión nuevamente.' });
      return;
    }

    if (decoded.action !== '2fa_login_challenge') {
      res.status(400).json({ success: false, message: 'Desafío 2FA inválido.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.tempUserId },
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

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      res.status(400).json({ success: false, message: 'Configuración 2FA no encontrada para este usuario.' });
      return;
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: String(code).trim(),
      window: 1, // Permite 30s de tolerancia por desincronización de reloj
    });

    if (!verified) {
      await logSecurityEvent({
        userId: user.id,
        action: '2FA_LOGIN_FAILED',
        module: 'AUTH',
        details: { reason: 'Código TOTP inválido' },
        req,
      });
      res.status(400).json({ success: false, message: 'Código de seguridad 2FA inválido o expirado.' });
      return;
    }

    // Login Exitoso con 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), failedAttempts: 0, lockedUntil: null },
    });

    await logSecurityEvent({
      userId: user.id,
      action: 'LOGIN_2FA_SUCCESS',
      module: 'AUTH',
      req,
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role.name,
      fullName: user.fullName,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role.name,
          permissions,
          twoFactorEnabled: true,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// 2FA: Generar secreto y código QR
export async function setup2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    const secret = speakeasy.generateSecret({
      name: `ERP Muller (${user.email})`,
      issuer: 'ERP Muller',
      length: 20,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCodeUrl,
        otpauthUrl: secret.otpauth_url,
      },
    });
  } catch (error) {
    next(error);
  }
}

// 2FA: Confirmar código y activar
export async function enable2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { secret, code } = req.body;
    if (!secret || !code) {
      res.status(400).json({ success: false, message: 'Se requiere el secreto y el código de verificación.' });
      return;
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: String(code).trim(),
      window: 1,
    });

    if (!verified) {
      res.status(400).json({
        success: false,
        message: 'Código de verificación incorrecto. Asegúrate de escanear el QR y verificar la hora de tu dispositivo.',
      });
      return;
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      },
    });

    await logSecurityEvent({
      userId: req.user.userId,
      action: '2FA_ENABLED',
      module: 'AUTH',
      req,
    });

    res.json({ success: true, message: 'Autenticación de dos factores (2FA) activada exitosamente.' });
  } catch (error) {
    next(error);
  }
}

// 2FA: Desactivar con contraseña de confirmación
export async function disable2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { password } = req.body;
    if (!password) {
      res.status(400).json({ success: false, message: 'Se requiere la contraseña actual para desactivar 2FA.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await logSecurityEvent({
        userId: user.id,
        action: '2FA_DISABLE_FAILED_PASSWORD',
        module: 'AUTH',
        req,
      });
      res.status(400).json({ success: false, message: 'Contraseña incorrecta.' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await logSecurityEvent({
      userId: user.id,
      action: '2FA_DISABLED',
      module: 'AUTH',
      req,
    });

    res.json({ success: true, message: 'Autenticación de dos factores desactivada correctamente.' });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        twoFactorEnabled: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: {
              select: {
                permission: {
                  select: { code: true, name: true, module: true },
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

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role.name,
        permissions,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      await logSecurityEvent({
        userId: user.id,
        action: 'CHANGE_PASSWORD_FAILED',
        module: 'AUTH',
        details: { reason: 'Contraseña actual incorrecta' },
        req,
      });
      res.status(400).json({ success: false, message: 'La contraseña actual no es correcta' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await logSecurityEvent({
      userId: user.id,
      action: 'UPDATE_PASSWORD_SUCCESS',
      module: 'AUTH',
      req,
    });

    res.json({ success: true, message: 'Contraseña actualizada correctamente con las políticas de seguridad' });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.clearCookie('token');

    if (req.user?.userId) {
      await logSecurityEvent({
        userId: req.user.userId,
        action: 'LOGOUT',
        module: 'AUTH',
        req,
      });
    }

    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  } catch (error) {
    next(error);
  }
}
