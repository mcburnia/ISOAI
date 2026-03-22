import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const createSchema = z.object({
  systemId: z.string(),
  date: z.string(),
  type: z.enum(['OUTPUT_REVIEW', 'OPERATIONAL_OBSERVATION', 'DATA_REVIEW', 'CONTEXT_REVIEW']),
  findings: z.string().min(1),
  performanceStatus: z.enum(['SATISFACTORY', 'CONCERNS_IDENTIFIED', 'ACTION_REQUIRED']),
  followUpActions: z.string().optional(),
});

export async function listRecords(req: Request, res: Response): Promise<void> {
  const where = req.query.systemId ? { systemId: req.query.systemId as string } : {};
  const records = await prisma.monitoringRecord.findMany({
    where,
    include: {
      system: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json({ records });
}

export async function createRecord(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const record = await prisma.monitoringRecord.create({
    data: {
      ...parsed.data,
      date: new Date(parsed.data.date),
      reviewerId: req.user!.userId,
    },
    include: {
      system: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });
  await logActivity(req, 'CREATE', 'MONITORING', record.id, record.type, `System: ${record.system.name}, Status: ${record.performanceStatus}`);
  res.status(201).json({ record });
}
