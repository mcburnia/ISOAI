import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that requires write access to compliance modules.
 * Allows SUPER_ADMIN, ADMIN, and COMPLIANCE_USER.
 * Blocks AUDITOR (read-only role).
 */
export function requireComplianceUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_USER'].includes(req.user.role)) {
    res.status(403).json({ error: 'Compliance access required' });
    return;
  }
  next();
}
