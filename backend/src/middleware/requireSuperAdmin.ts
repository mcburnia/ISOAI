import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that requires the user to have SUPER_ADMIN or ADMIN role.
 * Used for platform-level operations (tenant management, standard management).
 *
 * For now, ADMIN role users can access platform routes.
 * In SaaS mode, this should be restricted to SUPER_ADMIN only.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(req.user.role)) {
    res.status(403).json({ error: 'Platform admin access required' });
    return;
  }
  next();
}
