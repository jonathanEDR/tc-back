import winston from 'winston';

// Configuración del logger seguro
const isDev = process.env.NODE_ENV === 'development';

// Crear el logger con configuración segura
const secureLogger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    // Filtrar información sensible
    winston.format.printf((info) => {
      // Remover información sensible de los logs
      const sanitizedInfo = sanitizeLogData(info);
      return JSON.stringify(sanitizedInfo);
    })
  ),
  defaultMeta: { service: 'vcaja-backend' },
  transports: [
    // Log de errores a archivo (solo en producción)
    ...(isDev ? [] : [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ]),
    // Console transport con formato simple en desarrollo
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      silent: !isDev // Solo mostrar en desarrollo
    })
  ]
});

// Función para sanitizar datos sensibles
function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveKeys = [
    'password', 'token', 'authorization', 'secret', 'key',
    'bearer', 'jwt', 'session', 'cookie', 'clerk', 'auth'
  ];

  // Sanitizar recursivamente
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

    if (isSensitive) {
      // Reemplazar con información no sensible
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 0) {
        sanitized[key] = `[REDACTED-${sanitized[key].length}chars]`;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  });

  return sanitized;
}

// Wrapper para logging de autenticación
export const authLogger = {
  info: (message: string, meta?: any) => {
    secureLogger.info(message, sanitizeLogData(meta));
  },
  warn: (message: string, meta?: any) => {
    secureLogger.warn(message, sanitizeLogData(meta));
  },
  error: (message: string, meta?: any) => {
    secureLogger.error(message, sanitizeLogData(meta));
  },
  debug: (message: string, meta?: any) => {
    if (isDev) {
      secureLogger.debug(message, sanitizeLogData(meta));
    }
  }
};

// Wrapper para logging de API
export const apiLogger = {
  request: (req: any, additionalData?: any) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    secureLogger.info('API Request', sanitizeLogData(logData));
  },
  response: (req: any, res: any, responseTime?: number) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: responseTime ? `${responseTime}ms` : undefined,
      timestamp: new Date().toISOString()
    };
    secureLogger.info('API Response', logData);
  },
  error: (error: any, req?: any, additionalData?: any) => {
    const logData = {
      error: {
        message: error.message,
        stack: isDev ? error.stack : undefined,
        name: error.name
      },
      method: req?.method,
      url: req?.originalUrl,
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    secureLogger.error('API Error', sanitizeLogData(logData));
  }
};

export default secureLogger;