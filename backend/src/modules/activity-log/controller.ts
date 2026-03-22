import { Request, Response } from 'express';
import { prisma } from '../../prisma';

export async function listActivityLogs(req: Request, res: Response): Promise<void> {
  const { entity, action, userId, limit = '50', offset = '0' } = req.query;

  const where: Record<string, unknown> = {};
  if (entity) where.entity = entity as string;
  if (action) where.action = action as string;
  if (userId) where.userId = userId as string;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 100),
      skip: Number(offset),
    }),
    prisma.activityLog.count({ where }),
  ]);

  res.json({ logs, total });
}
