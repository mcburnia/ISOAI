import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '@prisma/client';
import { getTenantDb, getPlatformDb } from './services/tenantManager';

/**
 * AsyncLocalStorage holds the current tenant's schema name for the request.
 * Set by the authenticate middleware (for authenticated routes) or
 * the tenantContext middleware (for unauthenticated routes like login).
 */
export const tenantSchemaStore = new AsyncLocalStorage<string>();

/**
 * Proxy that transparently delegates all PrismaClient calls to the
 * correct tenant-scoped client based on the current AsyncLocalStorage context.
 *
 * All existing controllers continue to `import { prisma } from '../../prisma'`
 * with zero changes — the proxy handles routing under the hood.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const schemaName = tenantSchemaStore.getStore();
    if (!schemaName) {
      // No tenant context — this happens during seed scripts or platform operations.
      // Fall back to the default DATABASE_URL (tenant_template for migrations/seed).
      const fallback = getFallbackClient();
      return (fallback as any)[prop];
    }
    return (getTenantDb(schemaName) as any)[prop];
  },
});

// Lazy singleton for the fallback client (used when no tenant context is set)
let _fallbackClient: PrismaClient | null = null;
function getFallbackClient(): PrismaClient {
  if (!_fallbackClient) {
    _fallbackClient = new PrismaClient();
  }
  return _fallbackClient;
}

/**
 * Direct access to the platform PrismaClient.
 * Use this with $queryRaw / $executeRaw for platform-level operations
 * (Tenant, PlatformUser, Standard, TenantStandard tables).
 */
export { getPlatformDb } from './services/tenantManager';
