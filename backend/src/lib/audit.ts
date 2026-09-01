import { Request } from 'express';
import { prisma } from './prisma';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  module: string;
  entityId?: string | null;
  details?: Record<string, any>;
  req?: Request;
}

export async function logSecurityEvent({
  userId,
  action,
  module,
  entityId,
  details,
  req,
}: AuditLogParams): Promise<void> {
  try {
    const ipAddress = req
      ? (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip
      : undefined;
    const userAgent = req ? req.get('user-agent') : undefined;

    await prisma.auditLog.create({
      data: {
        userId: userId || undefined,
        action,
        module,
        entityId: entityId || undefined,
        details: details ? details : undefined,
        ipAddress: ipAddress ? String(ipAddress).slice(0, 100) : undefined,
        userAgent: userAgent ? String(userAgent).slice(0, 255) : undefined,
      },
    });
  } catch (error) {
    // Si falla el log no rompemos el flujo principal, pero lo advertimos
    console.error(`[AUDIT_ERROR] No se pudo guardar el log de auditoría (${action}):`, error);
  }
}
