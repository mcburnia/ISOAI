import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const createSystemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  ownerId: z.string(),
  environment: z.enum(['RESEARCH', 'DEVELOPMENT', 'INTERNAL_ANALYSIS', 'PRODUCTION', 'CONSULTING']),
  systemType: z.enum(['ML_MODEL', 'LLM_APPLICATION', 'ANALYTICAL_TOOL', 'DECISION_SUPPORT', 'AGENT_AUTOMATION']),
  riskClassification: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  humanOversight: z.string().min(1),
  deploymentStatus: z.enum(['DEVELOPMENT', 'TESTING', 'ACTIVE', 'SUSPENDED', 'RETIRED']),
});

export async function listSystems(_req: Request, res: Response): Promise<void> {
  const systems = await prisma.aISystem.findMany({
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ systems });
}

export async function getSystem(req: Request, res: Response): Promise<void> {
  const system = await prisma.aISystem.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      risks: true,
      lifecycleEntries: { orderBy: { stage: 'asc' } },
      incidents: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!system) {
    res.status(404).json({ error: 'System not found' });
    return;
  }
  res.json({ system });
}

export async function createSystem(req: Request, res: Response): Promise<void> {
  const parsed = createSystemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const system = await prisma.aISystem.create({
    data: parsed.data,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  await logActivity(req, 'CREATE', 'SYSTEM', system.id, system.name, `Risk: ${system.riskClassification}, Environment: ${system.environment}`);
  res.status(201).json({ system });
}

export async function updateSystem(req: Request, res: Response): Promise<void> {
  const existing = await prisma.aISystem.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'System not found' });
    return;
  }

  const system = await prisma.aISystem.update({
    where: { id: req.params.id },
    data: req.body,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  const changes: string[] = [];
  if (req.body.deploymentStatus && req.body.deploymentStatus !== existing.deploymentStatus) {
    changes.push(`Status: ${existing.deploymentStatus} → ${req.body.deploymentStatus}`);
  }
  if (req.body.riskClassification && req.body.riskClassification !== existing.riskClassification) {
    changes.push(`Risk: ${existing.riskClassification} → ${req.body.riskClassification}`);
  }
  await logActivity(req, 'UPDATE', 'SYSTEM', system.id, system.name, changes.join(', ') || undefined);
  res.json({ system });
}

export async function deleteSystem(req: Request, res: Response): Promise<void> {
  const existing = await prisma.aISystem.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'System not found' });
    return;
  }

  await prisma.aISystem.delete({ where: { id: req.params.id } });
  await logActivity(req, 'DELETE', 'SYSTEM', existing.id, existing.name);
  res.json({ message: 'System deleted' });
}
