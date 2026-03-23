import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that requires organisation administrator access.
 * Allows ADMIN and SUPER_ADMIN (site admin can do anything org admin can).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
