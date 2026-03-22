import { Request, Response } from 'express';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const LIFECYCLE_STAGES = [
  { stage: 1, stageName: 'Concept & Initial Assessment' },
  { stage: 2, stageName: 'Design & Architecture Review' },
  { stage: 3, stageName: 'Risk Assessment' },
  { stage: 4, stageName: 'Development & Testing' },
  { stage: 5, stageName: 'Deployment Approval' },
  { stage: 6, stageName: 'Operational Monitoring' },
  { stage: 7, stageName: 'Review & Retirement' },
];

export async function listEntries(req: Request, res: Response): Promise<void> {
  const where = req.query.systemId ? { systemId: req.query.systemId as string } : {};
  const entries = await prisma.lifecycleEntry.findMany({
    where,
    include: {
      system: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { stage: 'asc' },
  });
  res.json({ entries });
}

export async function initLifecycle(req: Request, res: Response): Promise<void> {
  const { systemId } = req.params;

  const system = await prisma.aISystem.findUnique({ where: { id: systemId } });
  if (!system) {
    res.status(404).json({ error: 'System not found' });
    return;
  }

  const existing = await prisma.lifecycleEntry.findFirst({ where: { systemId } });
  if (existing) {
    res.status(409).json({ error: 'Lifecycle already initialised for this system' });
    return;
  }

  const entries = await prisma.$transaction(
    LIFECYCLE_STAGES.map((s) =>
      prisma.lifecycleEntry.create({
        data: { systemId, stage: s.stage, stageName: s.stageName },
      })
    )
  );

  await logActivity(req, 'CREATE', 'LIFECYCLE', systemId, system.name, 'Lifecycle initialised');
  res.status(201).json({ entries });
}

export async function createEntry(req: Request, res: Response): Promise<void> {
  const entry = await prisma.lifecycleEntry.create({
    data: req.body,
    include: {
      system: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });
  await logActivity(req, 'CREATE', 'LIFECYCLE', entry.id, entry.stageName, `System: ${entry.system.name}`);
  res.status(201).json({ entry });
}

export async function updateEntry(req: Request, res: Response): Promise<void> {
  const existing = await prisma.lifecycleEntry.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Lifecycle entry not found' });
    return;
  }

  const data = { ...req.body };
  if (data.status === 'COMPLETED') {
    data.completedAt = new Date();
    data.approvedById = req.user!.userId;
  }

  const entry = await prisma.lifecycleEntry.update({
    where: { id: req.params.id },
    data,
    include: {
      system: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  const action = data.status === 'COMPLETED' ? 'APPROVE' : 'UPDATE';
  await logActivity(req, action, 'LIFECYCLE', entry.id, entry.stageName, `System: ${entry.system.name}, Status: ${entry.status}`);
  res.json({ entry });
}
