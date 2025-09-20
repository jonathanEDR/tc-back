import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/clerk-sdk-node';
import { authLogger } from '../utils/secureLogger';

const isDev = process.env.NODE_ENV === 'development';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    authLogger.debug('Authentication attempt', {
      hasAuthHeader: !!authHeader,
      url: req.originalUrl,
      method: req.method
    });

    const token = String(authHeader || '').replace(/^Bearer\s+/i, '') || undefined;

    if (!token) {
      authLogger.warn('No token provided', {
        url: req.originalUrl,
        method: req.method
      });
      return res.status(401).json({ error: 'No token provided' });
    }

    // Solo log formato básico en desarrollo, sin contenido del token
    authLogger.debug('Token format validation', {
      tokenLength: token.length,
      segments: (token.match(/\./g) || []).length + 1
    });

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        issuer: process.env.CLERK_ISSUER || 'https://clerk.clerk.accounts.dev',
      });

      // Extraer el userId del payload de Clerk
      const userId = (payload as any).sub;
      if (!userId) {
        authLogger.error('No user ID found in token payload');
        return res.status(401).json({ error: 'Invalid token format' });
      }

      // Asignar el payload completo para acceso consistente
      (req as any).user = { sub: userId, userId };

      authLogger.debug('Authentication successful', {
        url: req.originalUrl,
        method: req.method
      });

      return next();
    } catch (err) {
      authLogger.error('Token verification failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        hasSecretKey: !!process.env.CLERK_SECRET_KEY,
        issuer: process.env.CLERK_ISSUER,
        url: req.originalUrl
      });
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    authLogger.error('Unexpected authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: req.originalUrl
    });
    res.status(401).json({ error: 'Invalid token' });
  }
};
