import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

const createAuditSchema = z.object({
  title: z.string().min(1),
  date: z.string(),
  scope: z.string().min(1),
});

const createFindingSchema = z.object({
  finding: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  correctiveAction: z.string().optional(),
});

const createReviewSchema = z.object({
  date: z.string(),
  summary: z.string().min(1),
  decisions: z.string().min(1),
  actions: z.string().min(1),
});

export async function listAudits(_req: Request, res: Response): Promise<void> {
  const audits = await prisma.audit.findMany({
    include: { findings: true },
    orderBy: { date: 'desc' },
  });
  res.json({ audits });
}

export async function getAudit(req: Request, res: Response): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: req.params.id },
    include: { findings: true },
  });
  if (!audit) {
    res.status(404).json({ error: 'Audit not found' });
    return;
  }
  res.json({ audit });
}

export async function createAudit(req: Request, res: Response): Promise<void> {
  const parsed = createAuditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const audit = await prisma.audit.create({
    data: { ...parsed.data, date: new Date(parsed.data.date) },
  });
  await logActivity(req, 'CREATE', 'AUDIT', audit.id, audit.title);
  res.status(201).json({ audit });
}

export async function updateAudit(req: Request, res: Response): Promise<void> {
  const existing = await prisma.audit.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Audit not found' });
    return;
  }

  const data = { ...req.body };
  if (data.date) data.date = new Date(data.date);

  const audit = await prisma.audit.update({
    where: { id: req.params.id },
    data,
    include: { findings: true },
  });

  const changes: string[] = [];
  if (req.body.status && req.body.status !== existing.status) {
    changes.push(`Status: ${existing.status} → ${req.body.status}`);
  }
  await logActivity(req, 'UPDATE', 'AUDIT', audit.id, audit.title, changes.join(', ') || undefined);
  res.json({ audit });
}

export async function createFinding(req: Request, res: Response): Promise<void> {
  const parsed = createFindingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const finding = await prisma.auditFinding.create({
    data: { ...parsed.data, auditId: req.params.auditId },
  });
  const audit = await prisma.audit.findUnique({ where: { id: req.params.auditId } });
  await logActivity(req, 'CREATE', 'AUDIT_FINDING', finding.id, finding.finding.substring(0, 80), `Audit: ${audit?.title ?? req.params.auditId}, Severity: ${finding.severity}`);
  res.status(201).json({ finding });
}

export async function updateFinding(req: Request, res: Response): Promise<void> {
  const existing = await prisma.auditFinding.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Finding not found' });
    return;
  }

  const finding = await prisma.auditFinding.update({
    where: { id: req.params.id },
    data: req.body,
  });

  const changes: string[] = [];
  if (req.body.status && req.body.status !== existing.status) {
    changes.push(`Status: ${existing.status} → ${req.body.status}`);
  }
  await logActivity(req, 'UPDATE', 'AUDIT_FINDING', finding.id, finding.finding.substring(0, 80), changes.join(', ') || undefined);
  res.json({ finding });
}

export async function listReviews(_req: Request, res: Response): Promise<void> {
  const reviews = await prisma.managementReview.findMany({ orderBy: { date: 'desc' } });
  res.json({ reviews });
}

export async function getReview(req: Request, res: Response): Promise<void> {
  const review = await prisma.managementReview.findUnique({ where: { id: req.params.id } });
  if (!review) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  res.json({ review });
}

export async function createReview(req: Request, res: Response): Promise<void> {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const review = await prisma.managementReview.create({
    data: { ...parsed.data, date: new Date(parsed.data.date) },
  });
  await logActivity(req, 'CREATE', 'MANAGEMENT_REVIEW', review.id, review.summary.substring(0, 80));
  res.status(201).json({ review });
}
