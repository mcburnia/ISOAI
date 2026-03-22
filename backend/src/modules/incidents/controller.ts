import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const createIncidentSchema = z.object({
  systemId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  occurredAt: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  assignedToId: z.string().optional(),
});

export async function listIncidents(req: Request, res: Response): Promise<void> {
  const where = req.query.systemId ? { systemId: req.query.systemId as string } : {};
  const incidents = await prisma.incident.findMany({
    where,
    include: {
      system: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ incidents });
}

export async function getIncident(req: Request, res: Response): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: req.params.id },
    include: {
      system: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json({ incident });
}

export async function createIncident(req: Request, res: Response): Promise<void> {
  const parsed = createIncidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const incident = await prisma.incident.create({
    data: {
      ...parsed.data,
      occurredAt: new Date(parsed.data.occurredAt),
      reportedById: req.user!.userId,
    },
    include: {
      system: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  await logActivity(req, 'CREATE', 'INCIDENT', incident.id, incident.title, `Severity: ${incident.severity}, System: ${incident.system.name}`);
  res.status(201).json({ incident });
}

export async function updateIncident(req: Request, res: Response): Promise<void> {
  const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  const data = { ...req.body };
  if (data.occurredAt) data.occurredAt = new Date(data.occurredAt);
  if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
    data.resolvedAt = new Date();
  }

  const incident = await prisma.incident.update({
    where: { id: req.params.id },
    data,
    include: {
      system: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  const changes: string[] = [];
  if (req.body.status && req.body.status !== existing.status) {
    changes.push(`Status: ${existing.status} → ${req.body.status}`);
  }
  if (req.body.escalated && !existing.escalated) {
    changes.push('Escalated');
  }
  await logActivity(req, 'UPDATE', 'INCIDENT', incident.id, incident.title, changes.join(', ') || undefined);
  res.json({ incident });
}
