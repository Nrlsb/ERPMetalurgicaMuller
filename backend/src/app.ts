import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { helmetMiddleware, apiLimiter } from './middlewares/security.middleware';
import { config } from './config';

const app = express();

// 1. Cabeceras HTTP de Seguridad (Helmet)
app.use(helmetMiddleware);

// 2. CORS con Credenciales y Orígenes Autorizados
app.use(
  cors({
    origin: [config.clientUrl, 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Parser de Cookies (Firmadas con secreto)
app.use(cookieParser(config.cookie.secret));

// 4. Límite de tamaño de Payload (Prevenir ataques de sobrecarga)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Logging de peticiones HTTP
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// 6. Limitador Global de Tasa (Rate Limiting) para la API
app.use('/api/v1', apiLimiter);

// 7. Prefijo de rutas API v1
app.use('/api/v1', apiRoutes);

// 8. Manejo centralizado y seguro de errores
app.use(errorHandler);

export default app;
