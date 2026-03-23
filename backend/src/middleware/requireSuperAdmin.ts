import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Middleware that requires platform-level administrator access.
 * Used for tenant management, standard catalogue management, and platform operations.
 *
 * - SaaS mode: only SUPER_ADMIN users (Gibbs Consulting staff)
 * - Self-hosted (onpremise/dedicated): SUPER_ADMIN or ADMIN (safety net; Gibbs staff will always be SUPER_ADMIN)
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(403).json({ error: 'Platform admin access required' });
    return;
  }

  if (env.deploymentMode === 'saas') {
    if (!req.user.isSuperAdmin) {
      res.status(403).json({ error: 'Platform admin access required' });
      return;
    }
    next();
    return;
  }

  // Self-hosted: SUPER_ADMIN or ADMIN
  if (req.user.isSuperAdmin || req.user.role === 'ADMIN') {
    next();
    return;
  }

  res.status(403).json({ error: 'Platform admin access required' });
}
