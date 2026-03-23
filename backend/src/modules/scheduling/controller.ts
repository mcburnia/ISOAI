import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';
import { getActiveStandardCodes } from '../../services/activeStandards';

const OBLIGATION_TYPES = [
  'INTERNAL_AUDIT', 'MANAGEMENT_REVIEW', 'RISK_ASSESSMENT',
  'AI_SYSTEM_REVIEW', 'AI_IMPACT_ASSESSMENT', 'HUMAN_OVERSIGHT_REVIEW',
  'MONITORING_REVIEW', 'DOCUMENT_REVIEW', 'TRAINING_RENEWAL',
  'CORRECTIVE_ACTION_FOLLOWUP', 'COMPETENCE_EVALUATION',
] as const;

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM_DAYS'] as const;

const LINKED_ENTITY_TYPES = ['SYSTEM', 'DOCUMENT', 'TRAINING_MODULE', 'GOVERNANCE_ROLE', 'AUDIT_FINDING'] as const;

const createObligationSchema = z.object({
  type: z.enum(OBLIGATION_TYPES),
  title: z.string().min(1),
  description: z.string().optional(),
  standardCode: z.string().min(1),
  clauseRef: z.string().optional(),
  frequency: z.enum(FREQUENCIES),
  customDays: z.number().int().positive().optional(),
  anchorDate: z.string(),
  assigneeId: z.string().optional(),
  linkedEntityId: z.string().optional(),
  linkedEntityType: z.enum(LINKED_ENTITY_TYPES).optional(),
});

const updateObligationSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  customDays: z.number().int().positive().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

// ── Helpers ──

function frequencyToDays(frequency: string, customDays?: number | null): number {
  switch (frequency) {
    case 'MONTHLY': return 30;
    case 'QUARTERLY': return 91;
    case 'SEMI_ANNUAL': return 182;
    case 'ANNUAL': return 365;
    case 'CUSTOM_DAYS': return customDays || 365;
    default: return 365;
  }
}

function calculateNextDueDate(anchorDate: Date, frequency: string, customDays?: number | null): Date {
  const now = new Date();
  const periodMs = frequencyToDays(frequency, customDays) * 24 * 60 * 60 * 1000;
  let due = new Date(anchorDate);
  while (due <= now) {
    due = new Date(due.getTime() + periodMs);
  }
  return due;
}

function frequencyLabel(frequency: string, customDays?: number | null): string {
  switch (frequency) {
    case 'MONTHLY': return 'Monthly';
    case 'QUARTERLY': return 'Quarterly';
    case 'SEMI_ANNUAL': return 'Semi-annual';
    case 'ANNUAL': return 'Annual';
    case 'CUSTOM_DAYS': return `Every ${customDays ?? '?'} days`;
    default: return frequency;
  }
}

// ── Endpoints ──

export async function listObligations(req: Request, res: Response): Promise<void> {
  const activeCodes = await getActiveStandardCodes(req.user!.tenantId!);
  if (activeCodes.length === 0) {
    res.json({ obligations: [] });
    return;
  }

  const statusFilter = req.query.status as string | undefined;
  const standardFilter = req.query.standardCode as string | undefined;

  const where: any = {
    standardCode: { in: activeCodes },
  };
  if (statusFilter === 'ACTIVE' || statusFilter === 'PAUSED') {
    where.status = statusFilter;
  }
  if (standardFilter && activeCodes.includes(standardFilter)) {
    where.standardCode = standardFilter;
  }

  const obligations = await prisma.scheduledObligation.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true } },
      instances: {
        orderBy: { dueDate: 'desc' },
        take: 1,
      },
    },
    orderBy: { anchorDate: 'asc' },
  });

  const now = new Date();
  const enriched = obligations.map((ob) => {
    const latestInstance = ob.instances[0];
    const nextDueDate = calculateNextDueDate(ob.anchorDate, ob.frequency, ob.customDays);
    const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return {
      ...ob,
      instances: undefined,
      latestInstance,
      nextDueDate,
      daysUntilDue,
      frequencyLabel: frequencyLabel(ob.frequency, ob.customDays),
    };
  });

  res.json({ obligations: enriched });
}

export async function getObligation(req: Request, res: Response): Promise<void> {
  const obligation = await prisma.scheduledObligation.findUnique({
    where: { id: req.params.id },
    include: {
      assignee: { select: { id: true, name: true } },
      instances: {
        orderBy: { dueDate: 'desc' },
        include: {
          completedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!obligation) {
    res.status(404).json({ error: 'Obligation not found' });
    return;
  }

  res.json({ obligation });
}

export async function createObligation(req: Request, res: Response): Promise<void> {
  const parsed = createObligationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { anchorDate: anchorStr, ...rest } = parsed.data;
  const anchorDate = new Date(anchorStr);

  const obligation = await prisma.scheduledObligation.create({
    data: { ...rest, anchorDate },
  });

  // Create the first instance
  await prisma.obligationInstance.create({
    data: {
      obligationId: obligation.id,
      dueDate: anchorDate,
    },
  });

  await logActivity(req, 'CREATE', 'SCHEDULED_OBLIGATION', obligation.id, obligation.title,
    `Type: ${obligation.type}, Frequency: ${frequencyLabel(obligation.frequency, obligation.customDays)}, Standard: ${obligation.standardCode}`);

  res.status(201).json({ obligation });
}

export async function updateObligation(req: Request, res: Response): Promise<void> {
  const existing = await prisma.scheduledObligation.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Obligation not found' });
    return;
  }

  const parsed = updateObligationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const obligation = await prisma.scheduledObligation.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  const changes: string[] = [];
  if (parsed.data.status && parsed.data.status !== existing.status) {
    changes.push(`Status: ${existing.status} → ${parsed.data.status}`);
  }
  if (parsed.data.frequency && parsed.data.frequency !== existing.frequency) {
    changes.push(`Frequency: ${frequencyLabel(existing.frequency, existing.customDays)} → ${frequencyLabel(parsed.data.frequency, parsed.data.customDays)}`);
  }
  if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== existing.assigneeId) {
    changes.push('Assignee changed');
  }

  await logActivity(req, 'UPDATE', 'SCHEDULED_OBLIGATION', obligation.id, obligation.title, changes.join(', ') || undefined);
  res.json({ obligation });
}

export async function completeInstance(req: Request, res: Response): Promise<void> {
  const instance = await prisma.obligationInstance.findUnique({
    where: { id: req.params.id },
    include: { obligation: true },
  });

  if (!instance) {
    res.status(404).json({ error: 'Instance not found' });
    return;
  }

  if (instance.status !== 'PENDING') {
    res.status(400).json({ error: 'Instance is not pending' });
    return;
  }

  const { notes, linkedRecordId, linkedRecordType } = req.body || {};

  const updated = await prisma.obligationInstance.update({
    where: { id: req.params.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedById: req.user!.userId,
      notes: notes || null,
      linkedRecordId: linkedRecordId || null,
      linkedRecordType: linkedRecordType || null,
    },
  });

  // Create the next instance if the obligation is still active
  if (instance.obligation.status === 'ACTIVE') {
    const nextDue = calculateNextDueDate(
      instance.obligation.anchorDate,
      instance.obligation.frequency,
      instance.obligation.customDays,
    );
    await prisma.obligationInstance.create({
      data: {
        obligationId: instance.obligationId,
        dueDate: nextDue,
      },
    });
  }

  await logActivity(req, 'COMPLETE', 'OBLIGATION_INSTANCE', updated.id, instance.obligation.title,
    `Due: ${instance.dueDate.toISOString().split('T')[0]}`);

  res.json({ instance: updated });
}

export async function skipInstance(req: Request, res: Response): Promise<void> {
  const instance = await prisma.obligationInstance.findUnique({
    where: { id: req.params.id },
    include: { obligation: true },
  });

  if (!instance) {
    res.status(404).json({ error: 'Instance not found' });
    return;
  }

  if (instance.status !== 'PENDING') {
    res.status(400).json({ error: 'Instance is not pending' });
    return;
  }

  const { notes } = req.body || {};
  if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
    res.status(400).json({ error: 'Notes are required when skipping an obligation' });
    return;
  }

  const updated = await prisma.obligationInstance.update({
    where: { id: req.params.id },
    data: {
      status: 'SKIPPED',
      notes,
    },
  });

  // Create the next instance if the obligation is still active
  if (instance.obligation.status === 'ACTIVE') {
    const nextDue = calculateNextDueDate(
      instance.obligation.anchorDate,
      instance.obligation.frequency,
      instance.obligation.customDays,
    );
    await prisma.obligationInstance.create({
      data: {
        obligationId: instance.obligationId,
        dueDate: nextDue,
      },
    });
  }

  await logActivity(req, 'SKIP', 'OBLIGATION_INSTANCE', updated.id, instance.obligation.title,
    `Due: ${instance.dueDate.toISOString().split('T')[0]}, Reason: ${notes}`);

  res.json({ instance: updated });
}

export async function getSchedulingSummary(req: Request, res: Response): Promise<void> {
  const activeCodes = await getActiveStandardCodes(req.user!.tenantId!);
  if (activeCodes.length === 0) {
    res.json({ upcoming: 0, overdue: 0, completedThisMonth: 0 });
    return;
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeWhere = { obligation: { status: 'ACTIVE', standardCode: { in: activeCodes } } };

  const [upcoming, overdue, completedThisMonth] = await Promise.all([
    prisma.obligationInstance.count({
      where: { ...activeWhere, status: 'PENDING', dueDate: { lte: thirtyDaysFromNow } },
    }),
    prisma.obligationInstance.count({
      where: { ...activeWhere, status: 'PENDING', dueDate: { lt: now } },
    }),
    prisma.obligationInstance.count({
      where: { ...activeWhere, status: 'COMPLETED', completedAt: { gte: startOfMonth } },
    }),
  ]);

  res.json({ upcoming, overdue, completedThisMonth });
}
