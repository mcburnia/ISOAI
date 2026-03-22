import { Request, Response } from 'express';
import {
  listStandards,
  findStandardByCode,
  getTenantStandards,
  activateStandardForTenant,
  deactivateStandardForTenant,
} from '../../services/platformDb';
import { invalidateActiveStandardsCache } from '../../services/activeStandards';
import { logActivity } from '../../services/auditLog';

/**
 * List all available standards with activation status for the current tenant.
 * Returns each standard with an `activated` flag and `activatedAt` timestamp.
 */
export async function listTenantStandards(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId!;

  const [allStandards, tenantStandards] = await Promise.all([
    listStandards(),
    getTenantStandards(tenantId),
  ]);

  const activatedMap = new Map(
    tenantStandards.map((ts) => [ts.standard.code, ts.activated_at])
  );

  const standards = allStandards.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    shortTitle: s.short_title,
    category: s.category,
    description: s.description,
    controlCount: s.control_count,
    activated: activatedMap.has(s.code),
    activatedAt: activatedMap.get(s.code) || null,
  }));

  res.json({ standards });
}

/**
 * Activate a standard for the current tenant.
 */
export async function activateStandard(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId!;
  const code = req.params.code as string;

  const standard = await findStandardByCode(code);
  if (!standard) {
    res.status(404).json({ error: 'Standard not found' });
    return;
  }

  await activateStandardForTenant(tenantId, standard.id);
  invalidateActiveStandardsCache(tenantId);

  await logActivity(req, 'ACTIVATE', 'STANDARD', standard.id, standard.short_title);
  res.json({ activated: true, code });
}

/**
 * Deactivate a standard for the current tenant.
 */
export async function deactivateStandard(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId!;
  const code = req.params.code as string;

  const standard = await findStandardByCode(code);
  if (!standard) {
    res.status(404).json({ error: 'Standard not found' });
    return;
  }

  await deactivateStandardForTenant(tenantId, standard.id);
  invalidateActiveStandardsCache(tenantId);

  await logActivity(req, 'DEACTIVATE', 'STANDARD', standard.id, standard.short_title);
  res.json({ activated: false, code });
}
