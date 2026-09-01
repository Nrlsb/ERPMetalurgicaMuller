import app from './app';
import { config } from './config';
import { prisma } from './lib/prisma';

async function startServer() {
  try {
    // Probar conexión con Base de Datos
    await prisma.$connect();
    console.log('📦 Conexión a Base de Datos PostgreSQL establecida correctamente.');

    app.listen(config.port, () => {
      console.log(`🚀 Servidor Backend ERP Muller corriendo en el puerto http://localhost:${config.port}`);
      console.log(`📡 Endpoints API disponibles en: http://localhost:${config.port}/api/v1`);
      console.log(`🩺 Healthcheck: http://localhost:${config.port}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
