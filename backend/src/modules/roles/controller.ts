import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const assignSchema = z.object({
  userId: z.string(),
  role: z.enum([
    'AI_GOVERNANCE_LEAD',
    'TECHNICAL_ARCHITECTURE_LEAD',
    'DATA_GOVERNANCE_LEAD',
    'AI_SYSTEM_OWNER',
    'OPERATIONAL_REVIEWER',
  ]),
  systemId: z.string().optional(),
});

export async function listRoles(_req: Request, res: Response): Promise<void> {
  const roles = await prisma.governanceRole.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      system: { select: { id: true, name: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ roles });
}

export async function assignRole(req: Request, res: Response): Promise<void> {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const role = await prisma.governanceRole.create({
    data: parsed.data,
    include: {
      user: { select: { id: true, name: true, email: true } },
      system: { select: { id: true, name: true } },
    },
  });
  await logActivity(req, 'ASSIGN', 'GOVERNANCE_ROLE', role.id, role.role, `User: ${role.user.name}${role.system ? `, System: ${role.system.name}` : ''}`);
  res.status(201).json({ role });
}

export async function removeRole(req: Request, res: Response): Promise<void> {
  const existing = await prisma.governanceRole.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { name: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ error: 'Role assignment not found' });
    return;
  }

  await prisma.governanceRole.delete({ where: { id: req.params.id } });
  await logActivity(req, 'REMOVE', 'GOVERNANCE_ROLE', existing.id, existing.role, `User: ${existing.user.name}`);
  res.json({ message: 'Role assignment removed' });
}
