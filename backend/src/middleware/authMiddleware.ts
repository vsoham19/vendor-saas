import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Simple JWT authentication middleware used for all protected API routes.
 * It expects a Bearer token in the Authorization header.
 * The secret is read from the environment variable JWT_SECRET (validated at startup).
 * On success it attaches the decoded payload to `req.user`.
 */
export default function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Public health routes and the root route are already mounted before this middleware.
  // If the request does not need authentication, just continue.
  if (req.path === '/' || req.path.startsWith('/api/health')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string);
    // Attach payload (any) to request for downstream handlers.
    (req as any).user = payload;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
}
