import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const createSchema = z.object({
  userId: z.string(),
  topic: z.string().min(1),
  completedAt: z.string(),
  evidence: z.string().optional(),
  acknowledged: z.boolean().optional(),
  moduleId: z.string().optional(),
});

export async function listRecords(req: Request, res: Response): Promise<void> {
  const where = req.query.userId ? { userId: req.query.userId as string } : {};
  const records = await prisma.trainingRecord.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      module: { select: { id: true, slug: true, title: true } },
    },
    orderBy: { completedAt: 'desc' },
  });
  res.json({ records });
}

export async function createRecord(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const record = await prisma.trainingRecord.create({
    data: {
      ...parsed.data,
      completedAt: new Date(parsed.data.completedAt),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      module: { select: { id: true, slug: true, title: true } },
    },
  });
  await logActivity(req, 'CREATE', 'TRAINING', record.id, record.topic);
  res.status(201).json({ record });
}

// Training module endpoints

export async function listModules(req: Request, res: Response): Promise<void> {
  const where = req.query.standardCode
    ? { standardCode: req.query.standardCode as string }
    : {};
  const modules = await prisma.trainingModule.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      standardCode: true,
      durationMinutes: true,
      createdAt: true,
      _count: { select: { completions: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ modules });
}

export async function getModule(req: Request, res: Response): Promise<void> {
  const mod = await prisma.trainingModule.findUnique({
    where: { slug: req.params.slug },
  });
  if (!mod) {
    res.status(404).json({ error: 'Training module not found' });
    return;
  }
  res.json({
    module: {
      ...mod,
      sections: JSON.parse(mod.sections),
    },
  });
}

export async function completeModule(req: Request, res: Response): Promise<void> {
  const mod = await prisma.trainingModule.findUnique({
    where: { slug: req.params.slug },
  });
  if (!mod) {
    res.status(404).json({ error: 'Training module not found' });
    return;
  }

  const userId = req.user!.userId;

  // Check if already completed
  const existing = await prisma.trainingRecord.findFirst({
    where: { userId, moduleId: mod.id },
  });
  if (existing) {
    res.status(409).json({ error: 'Training module already completed', record: existing });
    return;
  }

  const record = await prisma.trainingRecord.create({
    data: {
      userId,
      moduleId: mod.id,
      topic: mod.title,
      completedAt: new Date(),
      acknowledged: true,
      evidence: 'Completed in-app training module with acknowledgement',
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      module: { select: { id: true, slug: true, title: true } },
    },
  });
  await logActivity(req, 'COMPLETE', 'TRAINING', record.id, mod.title);
  res.status(201).json({ record });
}

export async function getMyCompletion(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const mod = await prisma.trainingModule.findUnique({
    where: { slug: req.params.slug },
  });
  if (!mod) {
    res.status(404).json({ error: 'Training module not found' });
    return;
  }

  const record = await prisma.trainingRecord.findFirst({
    where: { userId, moduleId: mod.id },
  });
  res.json({ completed: !!record, record });
}
