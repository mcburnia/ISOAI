import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const createSchema = z.object({
  systemId: z.string(),
  reviewDate: z.string(),
  reviewType: z.enum(['OUTPUT_REVIEW', 'OPERATIONAL_OBSERVATION', 'PERIODIC_REVIEW']),
  findings: z.string().min(1),
  actionsTaken: z.string().optional(),
  concernsRaised: z.boolean().optional(),
  escalated: z.boolean().optional(),
});

export async function listRecords(req: Request, res: Response): Promise<void> {
  const where = req.query.systemId ? { systemId: req.query.systemId as string } : {};
  const records = await prisma.oversightRecord.findMany({
    where,
    include: {
      system: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { reviewDate: 'desc' },
  });
  res.json({ records });
}

export async function createRecord(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const record = await prisma.oversightRecord.create({
    data: {
      ...parsed.data,
      reviewDate: new Date(parsed.data.reviewDate),
      reviewerId: req.user!.userId,
    },
    include: {
      system: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });
  await logActivity(req, 'CREATE', 'OVERSIGHT', record.id, record.reviewType, `System: ${record.system.name}${record.concernsRaised ? ', Concerns raised' : ''}`);
  res.status(201).json({ record });
}
