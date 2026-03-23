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
import { getDefaultsForStandard, defaultAnchorDate } from '../../services/obligationDefaults';
import { prisma } from '../../prisma';

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

  // Reactivate any previously paused obligations for this standard
  await prisma.scheduledObligation.updateMany({
    where: { standardCode: code, status: 'PAUSED' },
    data: { status: 'ACTIVE' },
  });

  // Seed default obligations if none exist for this standard
  const existingCount = await prisma.scheduledObligation.count({
    where: { standardCode: code },
  });

  if (existingCount === 0) {
    const defaults = getDefaultsForStandard(code);
    for (const def of defaults) {
      const anchorDate = defaultAnchorDate(def.frequency);
      const obligation = await prisma.scheduledObligation.create({
        data: {
          type: def.type,
          title: `${def.titleTemplate} (${code.replace('ISO_', 'ISO ')})`,
          standardCode: code,
          clauseRef: def.clauseRef,
          frequency: def.frequency,
          anchorDate,
        },
      });
      await prisma.obligationInstance.create({
        data: { obligationId: obligation.id, dueDate: anchorDate },
      });
    }
  }

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

  // Pause all active obligations for this standard
  await prisma.scheduledObligation.updateMany({
    where: { standardCode: code, status: 'ACTIVE' },
    data: { status: 'PAUSED' },
  });

  await logActivity(req, 'DEACTIVATE', 'STANDARD', standard.id, standard.short_title);
  res.json({ activated: false, code });
}
