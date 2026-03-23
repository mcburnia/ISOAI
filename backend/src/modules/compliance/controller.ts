import { Request, Response } from 'express';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';
import { getActiveStandardCodes } from '../../services/activeStandards';

export async function listStandards(req: Request, res: Response): Promise<void> {
  const activeCodes = await getActiveStandardCodes(req.user!.tenantId!);
  if (activeCodes.length === 0) {
    res.json({ standards: [] });
    return;
  }

  const raw = await prisma.controlMapping.findMany({
    where: { standardCode: { in: activeCodes } },
    select: { standardCode: true },
    distinct: ['standardCode'],
    orderBy: { standardCode: 'asc' },
  });
  const standards = raw.map((r) => r.standardCode);
  res.json({ standards });
}

export async function listMappings(req: Request, res: Response): Promise<void> {
  const activeCodes = await getActiveStandardCodes(req.user!.tenantId!);
  if (activeCodes.length === 0) {
    res.json({ mappings: [] });
    return;
  }

  const where: any = { standardCode: { in: activeCodes } };
  if (req.query.standardCode) {
    // If a specific standard is requested, use it but only if it is active
    const requested = req.query.standardCode as string;
    if (!activeCodes.includes(requested)) {
      res.json({ mappings: [] });
      return;
    }
    where.standardCode = requested;
  }

  const mappings = await prisma.controlMapping.findMany({
    where,
    orderBy: { clauseNumber: 'asc' },
  });
  res.json({ mappings });
}

export async function updateMapping(req: Request, res: Response): Promise<void> {
  const existing = await prisma.controlMapping.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Control mapping not found' });
    return;
  }

  const mapping = await prisma.controlMapping.update({
    where: { id: req.params.id },
    data: req.body,
  });

  const changes: string[] = [];
  if (req.body.status && req.body.status !== existing.status) {
    changes.push(`Status: ${existing.status} → ${req.body.status}`);
  }
  await logActivity(req, 'UPDATE', 'CONTROL_MAPPING', mapping.id, `${mapping.clauseNumber} ${mapping.clauseTitle}`, changes.join(', ') || undefined);
  res.json({ mapping });
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const activeCodes = await getActiveStandardCodes(req.user!.tenantId!);
  const hasActiveStandards = activeCodes.length > 0;

  // Build where clause for standard-filtered queries
  const standardWhere = hasActiveStandards ? { standardCode: { in: activeCodes } } : { standardCode: 'NONE' };

  const [
    totalSystems,
    activeSystems,
    openRisks,
    activeIncidents,
    mappings,
    openFindings,
    totalUsers,
    totalTrainingRecords,
    totalModules,
    recentActivity,
    systemsNeedingReview,
    overdueTraining,
    upcomingObligations,
    overdueObligations,
  ] = await Promise.all([
    prisma.aISystem.count(),
    prisma.aISystem.count({ where: { deploymentStatus: 'ACTIVE' } }),
    prisma.risk.count({ where: { status: 'OPEN' } }),
    prisma.incident.count({ where: { status: { in: ['REPORTED', 'INVESTIGATING'] } } }),
    prisma.controlMapping.findMany({ where: standardWhere }),
    prisma.auditFinding.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.user.count(),
    prisma.trainingRecord.count(),
    hasActiveStandards
      ? prisma.trainingModule.count({ where: standardWhere })
      : Promise.resolve(0),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.aISystem.findMany({
      where: {
        deploymentStatus: 'ACTIVE',
        OR: [
          { lastReviewDate: null },
          { lastReviewDate: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        ],
      },
      select: { id: true, name: true, lastReviewDate: true },
    }),
    // Users who haven't completed all training modules
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { trainingRecords: true } },
      },
    }),
    // Scheduling: obligations due within 30 days
    hasActiveStandards
      ? prisma.obligationInstance.count({
          where: {
            status: 'PENDING',
            dueDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
            obligation: { status: 'ACTIVE', standardCode: { in: activeCodes } },
          },
        })
      : Promise.resolve(0),
    // Scheduling: overdue obligations
    hasActiveStandards
      ? prisma.obligationInstance.count({
          where: {
            status: 'PENDING',
            dueDate: { lt: new Date() },
            obligation: { status: 'ACTIVE', standardCode: { in: activeCodes } },
          },
        })
      : Promise.resolve(0),
  ]);

  const totalMappings = mappings.length;
  const compliantMappings = mappings.filter((m) => m.status === 'COMPLIANT').length;
  const partialMappings = mappings.filter((m) => m.status === 'PARTIAL').length;
  const compliancePercentage = totalMappings > 0
    ? Math.round((compliantMappings / totalMappings) * 100)
    : 0;

  // Per-standard compliance breakdown
  const byStandard: Record<string, { total: number; compliant: number; partial: number; notStarted: number }> = {};
  for (const m of mappings) {
    const code = (m as any).standardCode || 'UNKNOWN';
    if (!byStandard[code]) byStandard[code] = { total: 0, compliant: 0, partial: 0, notStarted: 0 };
    byStandard[code].total++;
    if (m.status === 'COMPLIANT') byStandard[code].compliant++;
    else if (m.status === 'PARTIAL') byStandard[code].partial++;
    else byStandard[code].notStarted++;
  }
  const standardsCompliance = Object.entries(byStandard).map(([code, data]) => ({
    standardCode: code,
    ...data,
    percentage: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0,
  })).sort((a, b) => a.standardCode.localeCompare(b.standardCode));

  const risksByCategory = await prisma.risk.groupBy({
    by: ['category'],
    where: { status: 'OPEN' },
    _count: true,
  });

  const risksBySeverity = await prisma.risk.groupBy({
    by: ['riskRating'],
    where: { status: 'OPEN' },
    _count: true,
  });

  // Calculate training completion rate
  const usersWithIncompleteTraining = overdueTraining.filter(
    (u) => u._count.trainingRecords < totalModules
  );
  const trainingCompletionRate = totalUsers > 0 && totalModules > 0
    ? Math.round(((totalUsers - usersWithIncompleteTraining.length) / totalUsers) * 100)
    : 0;

  res.json({
    dashboard: {
      totalSystems,
      activeSystems,
      openRisks,
      activeIncidents,
      openFindings,
      compliancePercentage,
      compliantMappings,
      partialMappings,
      notStartedMappings: totalMappings - compliantMappings - partialMappings,
      totalMappings,
      risksByCategory: risksByCategory.map((r) => ({ category: r.category, count: r._count })),
      risksBySeverity: risksBySeverity.map((r) => ({ rating: r.riskRating, count: r._count })),
      // New posture data
      trainingCompletionRate,
      totalUsers,
      usersWithIncompleteTraining: usersWithIncompleteTraining.length,
      systemsNeedingReview: systemsNeedingReview.map((s) => ({
        id: s.id,
        name: s.name,
        lastReviewDate: s.lastReviewDate,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        userName: a.userName,
        action: a.action,
        entity: a.entity,
        entityName: a.entityName,
        details: a.details,
        createdAt: a.createdAt,
      })),
      standardsCompliance,
      upcomingObligations,
      overdueObligations,
    },
  });
}
