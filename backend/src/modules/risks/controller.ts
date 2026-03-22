import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const createRiskSchema = z.object({
  systemId: z.string(),
  description: z.string().min(1),
  category: z.enum(['REGULATORY', 'OPERATIONAL', 'DATA', 'BIAS_FAIRNESS', 'SECURITY', 'MISUSE']),
  likelihood: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  mitigationMeasures: z.string(),
  ownerId: z.string(),
  reviewDate: z.string().optional(),
});

export async function listRisks(req: Request, res: Response): Promise<void> {
  const where = req.query.systemId ? { systemId: req.query.systemId as string } : {};
  const risks = await prisma.risk.findMany({
    where,
    include: {
      system: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ risks });
}

export async function getRisk(req: Request, res: Response): Promise<void> {
  const risk = await prisma.risk.findUnique({
    where: { id: req.params.id },
    include: {
      system: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });
  if (!risk) {
    res.status(404).json({ error: 'Risk not found' });
    return;
  }
  res.json({ risk });
}

export async function createRisk(req: Request, res: Response): Promise<void> {
  const parsed = createRiskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const data = {
    ...parsed.data,
    reviewDate: parsed.data.reviewDate ? new Date(parsed.data.reviewDate) : null,
  };

  const risk = await prisma.risk.create({
    data,
    include: {
      system: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });
  await logActivity(req, 'CREATE', 'RISK', risk.id, `${risk.category} (${risk.riskRating})`, `System: ${risk.system.name}`);
  res.status(201).json({ risk });
}

export async function updateRisk(req: Request, res: Response): Promise<void> {
  const existing = await prisma.risk.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Risk not found' });
    return;
  }

  const data = { ...req.body };
  if (data.reviewDate) data.reviewDate = new Date(data.reviewDate);

  const risk = await prisma.risk.update({
    where: { id: req.params.id },
    data,
    include: {
      system: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  const changes: string[] = [];
  if (req.body.status && req.body.status !== existing.status) {
    changes.push(`Status: ${existing.status} → ${req.body.status}`);
  }
  if (req.body.riskRating && req.body.riskRating !== existing.riskRating) {
    changes.push(`Rating: ${existing.riskRating} → ${req.body.riskRating}`);
  }
  await logActivity(req, 'UPDATE', 'RISK', risk.id, `${risk.category} (${risk.riskRating})`, changes.join(', ') || undefined);
  res.json({ risk });
}

export async function deleteRisk(req: Request, res: Response): Promise<void> {
  const existing = await prisma.risk.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Risk not found' });
    return;
  }

  await prisma.risk.delete({ where: { id: req.params.id } });
  await logActivity(req, 'DELETE', 'RISK', existing.id, `${existing.category} (${existing.riskRating})`);
  res.json({ message: 'Risk deleted' });
}
