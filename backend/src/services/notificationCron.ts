import cron from 'node-cron';
import { getPlatformDb, getTenantDb } from './tenantManager';
import { sendNotificationDigestEmail } from './email';

// ── Types ─────────────────────────────────────────────────────────────────

interface PendingNotification {
  userId: string;
  userEmail: string;
  userName: string;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ── Per-tenant check ──────────────────────────────────────────────────────

async function runForTenant(schemaName: string): Promise<void> {
  const db = getTenantDb(schemaName);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const pending: PendingNotification[] = [];

  // ── 1. Obligations due within 7 days ─────────────────────────────────

  const dueSoonInstances = await db.obligationInstance.findMany({
    where: {
      status: 'PENDING',
      dueDate: { gte: now, lte: sevenDaysFromNow },
      obligation: { status: 'ACTIVE', type: { not: 'COMPETENCE_EVALUATION' } },
    },
    include: {
      obligation: { include: { assignee: true } },
    },
  });

  for (const instance of dueSoonInstances) {
    const assignee = instance.obligation.assignee;
    if (!assignee) continue;

    // Skip if we already notified today for this instance
    const existing = await db.notification.findFirst({
      where: {
        userId: assignee.id,
        entityId: instance.id,
        type: 'OBLIGATION_DUE',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (existing) continue;

    const daysUntilDue = Math.ceil((instance.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dueLabel = daysUntilDue === 0 ? 'today' : daysUntilDue === 1 ? 'tomorrow' : `in ${daysUntilDue} days`;

    pending.push({
      userId: assignee.id,
      userEmail: assignee.email,
      userName: assignee.name,
      type: 'OBLIGATION_DUE',
      title: `Obligation due ${dueLabel}`,
      message: `${instance.obligation.title} is due ${dueLabel}.`,
      entityType: 'OBLIGATION',
      entityId: instance.id,
    });
  }

  // ── 2. Overdue obligations ────────────────────────────────────────────

  const overdueInstances = await db.obligationInstance.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now },
      obligation: { status: 'ACTIVE', type: { not: 'COMPETENCE_EVALUATION' } },
    },
    include: {
      obligation: { include: { assignee: true } },
    },
  });

  for (const instance of overdueInstances) {
    const assignee = instance.obligation.assignee;
    if (!assignee) continue;

    const existing = await db.notification.findFirst({
      where: {
        userId: assignee.id,
        entityId: instance.id,
        type: 'OBLIGATION_OVERDUE',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (existing) continue;

    const daysOverdue = Math.floor((now.getTime() - instance.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const overdueLabel = daysOverdue === 0 ? 'today' : daysOverdue === 1 ? 'yesterday' : `${daysOverdue} days ago`;

    pending.push({
      userId: assignee.id,
      userEmail: assignee.email,
      userName: assignee.name,
      type: 'OBLIGATION_OVERDUE',
      title: 'Obligation overdue',
      message: `${instance.obligation.title} was due ${overdueLabel} and has not been completed.`,
      entityType: 'OBLIGATION',
      entityId: instance.id,
    });
  }

  // ── 3. Competence checks due ──────────────────────────────────────────

  const competenceInstances = await db.obligationInstance.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lte: now },
      obligation: {
        status: 'ACTIVE',
        type: 'COMPETENCE_EVALUATION',
        assigneeId: { not: null },
      },
    },
    include: {
      obligation: { include: { assignee: true } },
    },
  });

  for (const instance of competenceInstances) {
    const assignee = instance.obligation.assignee;
    if (!assignee) continue;

    const existing = await db.notification.findFirst({
      where: {
        userId: assignee.id,
        entityId: instance.id,
        type: 'COMPETENCE_DUE',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (existing) continue;

    pending.push({
      userId: assignee.id,
      userEmail: assignee.email,
      userName: assignee.name,
      type: 'COMPETENCE_DUE',
      title: 'Competence check due',
      message: 'A competence check is ready for you. Sign in to complete it.',
      entityType: 'COMPETENCE',
      entityId: instance.id,
    });
  }

  // ── 4. Training renewal obligations ──────────────────────────────────

  const renewalInstances = await db.obligationInstance.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lte: sevenDaysFromNow },
      obligation: {
        status: 'ACTIVE',
        type: 'TRAINING_RENEWAL',
        assigneeId: { not: null },
      },
    },
    include: {
      obligation: { include: { assignee: true } },
    },
  });

  for (const instance of renewalInstances) {
    const assignee = instance.obligation.assignee;
    if (!assignee) continue;

    const existing = await db.notification.findFirst({
      where: {
        userId: assignee.id,
        entityId: instance.id,
        type: 'TRAINING_RENEWAL',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (existing) continue;

    pending.push({
      userId: assignee.id,
      userEmail: assignee.email,
      userName: assignee.name,
      type: 'TRAINING_RENEWAL',
      title: 'Training renewal required',
      message: `${instance.obligation.title}. Please complete your training retake.`,
      entityType: 'OBLIGATION',
      entityId: instance.id,
    });
  }

  if (pending.length === 0) return;

  // ── 5. Persist in-app notifications ──────────────────────────────────

  await db.notification.createMany({
    data: pending.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: n.entityId,
    })),
  });

  // ── 6. Send email digests (one per user) ──────────────────────────────

  const byUser = new Map<string, PendingNotification[]>();
  for (const n of pending) {
    const list = byUser.get(n.userId) ?? [];
    list.push(n);
    byUser.set(n.userId, list);
  }

  for (const [, notifications] of byUser) {
    const first = notifications[0];
    await sendNotificationDigestEmail(
      first.userEmail,
      first.userName,
      notifications.map((n) => ({ title: n.title, message: n.message, type: n.type }))
    );
  }

  console.log(`[notifications] ${schemaName}: created ${pending.length} notification(s) for ${byUser.size} user(s)`);
}

// ── Main cron job ─────────────────────────────────────────────────────────

export function startNotificationCron(): void {
  // Run daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    console.log('[notifications] Running daily notification check...');

    try {
      const platformDb = getPlatformDb();
      const tenants: Array<{ schema_name: string; status: string }> = await platformDb.$queryRaw`
        SELECT schema_name, status FROM platform."Tenant" WHERE status = 'ACTIVE'
      `;

      for (const tenant of tenants) {
        try {
          await runForTenant(tenant.schema_name);
        } catch (err: any) {
          console.error(`[notifications] Error processing tenant ${tenant.schema_name}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error('[notifications] Cron job failed:', err.message);
    }
  });

  console.log('[notifications] Daily cron job scheduled (08:00)');
}
