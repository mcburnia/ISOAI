import { PrismaClient } from '@prisma/client';
import { getPlatformDb } from '../../services/tenantManager';

/**
 * Builds a rich compliance snapshot for a tenant to inject into the AI system prompt.
 * Pulls live data so answers are grounded in the tenant's actual posture.
 */
export async function buildTenantContext(
  tenantId: string,
  schemaName: string,
  db: PrismaClient
): Promise<string> {
  const platformDb = getPlatformDb();

  // Tenant name
  const tenants: Array<{ name: string }> = await platformDb.$queryRaw`
    SELECT name FROM platform."Tenant" WHERE id = ${tenantId}
  `;
  const orgName = tenants[0]?.name ?? 'the organisation';

  // Active standards
  const activeStandards: Array<{ code: string; name: string }> = await platformDb.$queryRaw`
    SELECT s.code, s.name
    FROM platform."TenantStandard" ts
    JOIN platform."Standard" s ON s.id = ts."standardId"
    WHERE ts."tenantId" = ${tenantId} AND ts.active = true
    ORDER BY s.code
  `;

  // Compliance posture per standard
  const allMappings = await db.controlMapping.findMany({
    select: { standardCode: true, status: true },
  });

  const byStandard = new Map<string, { total: number; compliant: number; partial: number; notStarted: number }>();
  for (const m of allMappings) {
    if (!byStandard.has(m.standardCode)) {
      byStandard.set(m.standardCode, { total: 0, compliant: 0, partial: 0, notStarted: 0 });
    }
    const entry = byStandard.get(m.standardCode)!;
    entry.total++;
    if (m.status === 'COMPLIANT') entry.compliant++;
    else if (m.status === 'PARTIAL') entry.partial++;
    else entry.notStarted++;
  }

  const complianceLines = activeStandards.map((s) => {
    const stats = byStandard.get(s.code);
    if (!stats || stats.total === 0) return `  - ${s.code} (${s.name}): No controls mapped yet`;
    const pct = Math.round((stats.compliant / stats.total) * 100);
    return `  - ${s.code} (${s.name}): ${pct}% compliant (${stats.compliant} compliant, ${stats.partial} partial, ${stats.notStarted} not started out of ${stats.total} controls)`;
  });

  // Operational snapshot
  const [systemCount, openRisks, activeIncidents, openFindings, userCount, trainingRate] =
    await Promise.all([
      db.aISystem.count(),
      db.risk.count({ where: { status: 'OPEN' } }),
      db.incident.count({ where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      db.auditFinding.count({ where: { status: 'OPEN' } }),
      db.user.count(),
      db.trainingRecord.count().then(async (completed) => {
        const total = await db.user.count();
        const modules = await db.trainingModule.count();
        const maxPossible = total * modules;
        return maxPossible > 0 ? Math.round((completed / maxPossible) * 100) : 0;
      }),
    ]);

  // Upcoming overdue obligations (top 5)
  const overdueInstances = await db.obligationInstance.findMany({
    where: { status: 'PENDING', dueDate: { lt: new Date() } },
    include: { obligation: { select: { title: true, type: true } } },
    orderBy: { dueDate: 'asc' },
    take: 5,
  });

  const overdueLines = overdueInstances.map((i) => {
    const daysOver = Math.floor((Date.now() - i.dueDate.getTime()) / 86400000);
    return `  - ${i.obligation.title} (${daysOver}d overdue)`;
  });

  // Build context string
  const lines = [
    `Organisation: ${orgName}`,
    `Active ISO standards: ${activeStandards.map((s) => s.code).join(', ') || 'None activated'}`,
    '',
    'Compliance posture:',
    ...complianceLines,
    '',
    'Operational snapshot:',
    `  - AI systems in inventory: ${systemCount}`,
    `  - Open risks: ${openRisks}`,
    `  - Active incidents: ${activeIncidents}`,
    `  - Open audit findings: ${openFindings}`,
    `  - Users: ${userCount}`,
    `  - Training completion rate: ~${trainingRate}%`,
  ];

  if (overdueInstances.length > 0) {
    lines.push('', 'Overdue obligations:');
    lines.push(...overdueLines);
  }

  return lines.join('\n');
}
