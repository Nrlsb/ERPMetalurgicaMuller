import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// 1. Configuración de Helmet para Cabeceras HTTP Seguras
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'http://localhost:3000', 'http://localhost:4000'],
    },
  },
  crossOriginEmbedderPolicy: false, // Permitir carga de recursos externos en desarrollo
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' }, // Anti-clickjacking
  hidePoweredBy: true, // Ocultar X-Powered-By: Express
  hsts: {
    maxAge: 31536000, // 1 año de HSTS
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true, // X-Content-Type-Options: nosniff
  xssFilter: true,
});

// 2. Limitador Global de Peticiones para la API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // Máximo 300 peticiones por ventana de 15 minutos por IP
  standardHeaders: true, // Retorna cabeceras `RateLimit-*` estándar
  legacyHeaders: false, // Deshabilita cabeceras `X-RateLimit-*`
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta dirección IP. Intente nuevamente en 15 minutos.',
  },
});

// 3. Limitador Estricto para Rutas de Autenticación (Login, 2FA, etc.)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos por cada 15 minutos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de acceso fallidos desde esta IP. Por seguridad, espere 15 minutos antes de reintentar.',
  },
});
