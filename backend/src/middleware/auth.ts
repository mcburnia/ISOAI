import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { tenantSchemaStore } from '../prisma';

export interface AuthPayload {
  userId: string;
  role: string;
  tenantId?: string;
  schemaName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      tenantId?: string;
      schemaName?: string;
    }
  }
}

/**
 * JWT authentication middleware.
 * Verifies the token, sets req.user, and enters the tenant's
 * AsyncLocalStorage context so all downstream Prisma queries
 * are automatically routed to the correct tenant schema.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.user = payload;
    req.tenantId = payload.tenantId;
    req.schemaName = payload.schemaName;

    // Enter tenant context for the remainder of this request
    if (payload.schemaName) {
      tenantSchemaStore.run(payload.schemaName, () => next());
    } else {
      next();
    }
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
