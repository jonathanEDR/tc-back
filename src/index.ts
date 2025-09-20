import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { connectDB, disconnectDB } from './utils/db';
import logger from './utils/logger';
import { apiLogger } from './utils/secureLogger';
import apiRouter from './routes';

dotenv.config();

const app = express();

// Middlewares de seguridad y parsing
app.use(helmet());
app.use(compression());

const isDev = process.env.NODE_ENV === 'development';

// Configuración de CORS segura
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:5173', // Desarrollo local (Vite)
      'http://localhost:3000', // Desarrollo local (alternativo)
      'https://tc-front.vercel.app', // Dominio de Vercel
      process.env.CORS_ORIGIN, // Variable de entorno adicional
    ].filter(Boolean); // Filtrar valores undefined/null

    // En desarrollo, permitir requests sin origin SOLO para herramientas como Postman
    if (!origin) {
      if (isDev) {
        logger.debug('CORS: Allowing request without origin (development tools)');
        return callback(null, true);
      } else {
        // En producción, rechazar requests sin origin por seguridad
        logger.warn('CORS: Rejecting request without origin in production');
        return callback(new Error('Origin required in production'));
      }
    }

    if (origin && allowedOrigins.includes(origin)) {
      logger.debug('CORS: Origin allowed', { origin });
      callback(null, true);
    } else {
      logger.warn('CORS: Origin not allowed', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Permitir cookies/headers de autenticación
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  // Configuraciones adicionales de seguridad
  optionsSuccessStatus: 200, // Para soporte legacy IE11
  maxAge: isDev ? 86400 : 3600, // Cache preflight requests (24h dev, 1h prod)
};

app.use(cors(corsOptions));
// Capture raw body for debugging/parsing when necessary (keeps parsed JSON too)
app.use(express.json({
  limit: '10kb',
  verify: (req: any, _res, buf: Buffer) => {
    try {
      req.rawBody = buf && buf.length ? buf.toString('utf8') : '';
    } catch (e) {
      req.rawBody = undefined;
    }
  }
}));

// Logging de requests
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiter para API general - más permisivo
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // máximo 50 requests por minuto por IP (más permisivo)
  message: {
    error: 'Demasiadas peticiones desde esta IP, prueba de nuevo en un minuto.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting para localhost en desarrollo pero mantener para otros
    return process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1';
  }
});

// Rate limiter específico para rutas de caja (más estricto)
const cajaLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 segundos (menos tiempo)
  max: 15, // máximo 15 requests por 10 segundos (más permisivo)
  message: {
    error: 'Demasiadas peticiones a la API de caja, espera un momento.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // En desarrollo, ser más permisivo pero no desactivar completamente
    return process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1';
  }
});

app.use(limiter);

// Aplicar rate limiter específico para rutas de caja
app.use('/api/caja', cajaLimiter);

// API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'vcaja-backend'
  });
});

// Health / root
app.get('/', (req, res) => res.send('Servidor backend activo'));

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    if (process.env.SKIP_DB === 'true') {
      logger.info('SKIP_DB=true -> no se intentará conectar a MongoDB (modo prueba)');
    } else {
      await connectDB();
      logger.info('DB conectada');
    }

    // Intentar escuchar en el puerto, con reintentos si está en uso
    const maxRetries = 5;
    let attempts = 0;
    let currentServer: any = null;
    let shutdownRegistered = false;

    const registerShutdown = () => {
      if (shutdownRegistered) return;
      shutdownRegistered = true;
      const shutdown = async () => {
        logger.info('Shutting down...');
        try {
          if (currentServer && typeof currentServer.close === 'function') {
            await new Promise<void>((resolve, reject) => {
              currentServer.close((err: any) => {
                if (err) return reject(err);
                resolve();
              });
            });
          }
        } catch (err) {
          logger.error('Error closing server: %o', err);
        }
        await disconnectDB();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    };

    const tryListen = (port: number) => {
      attempts += 1;
      try {
        currentServer = app.listen(port, () => logger.info(`Server listening on port ${port}`));
      } catch (err: any) {
        logger.warn('Listen threw error on port %d: %o', port, err);
        if (err && err.code === 'EADDRINUSE') {
          logger.warn('Port %d in use, attempt %d/%d', port, attempts, maxRetries);
          if (attempts < maxRetries) {
            return tryListen(port + 1);
          }
          logger.error('All port retry attempts failed. Exiting.');
          disconnectDB().finally(() => process.exit(1));
        } else {
          logger.error('Unexpected listen error: %o', err);
          disconnectDB().finally(() => process.exit(1));
        }
        return;
      }

      // handle async 'error' events on the server
      currentServer.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          logger.warn('Port %d in use (async), attempt %d/%d', port, attempts, maxRetries);
          // Do not call close() on a server that never started; just try next port
          if (attempts < maxRetries) {
            tryListen(port + 1);
            return;
          }
          logger.error('All port retry attempts failed. Exiting.');
          disconnectDB().finally(() => process.exit(1));
        } else {
          logger.error('Server error: %o', err);
          disconnectDB().finally(() => process.exit(1));
        }
      });

      registerShutdown();
    };

    tryListen(PORT);
  } catch (err) {
    logger.error('Startup error: %o', err);
    process.exit(1);
  }
}

start();
