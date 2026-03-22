import { getTenantStandards } from './platformDb';

/**
 * Cached lookup of a tenant's active standard codes.
 * Returns the list of standardCode values (e.g. 'ISO_42001', 'ISO_27001')
 * that the tenant has activated in the platform schema.
 *
 * Cache is in-memory with a 5-minute TTL, invalidated explicitly
 * when standards are activated or deactivated.
 */

const cache = new Map<string, { codes: string[]; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function getActiveStandardCodes(tenantId: string): Promise<string[]> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.codes;

  const rows = await getTenantStandards(tenantId);
  const codes = rows.map((r) => r.standard.code);
  cache.set(tenantId, { codes, expiresAt: Date.now() + TTL_MS });
  return codes;
}

export function invalidateActiveStandardsCache(tenantId: string): void {
  cache.delete(tenantId);
}
