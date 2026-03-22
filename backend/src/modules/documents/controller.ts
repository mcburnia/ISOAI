import { Request, Response } from 'express';
import { prisma } from '../../prisma';
import { logActivity } from '../../services/auditLog';

export async function listDocuments(_req: Request, res: Response): Promise<void> {
  const documents = await prisma.document.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      documentType: true,
      owner: true,
      version: true,
      status: true,
      reviewCycle: true,
      lastReviewedAt: true,
      updatedAt: true,
    },
    orderBy: { title: 'asc' },
  });
  res.json({ documents });
}

export async function getDocument(req: Request, res: Response): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { slug: req.params.slug },
  });
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json({ document });
}

export async function updateDocument(req: Request, res: Response): Promise<void> {
  const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const { status, version, owner, reviewCycle, approvalAuthority, content } = req.body;
  const document = await prisma.document.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status }),
      ...(version && { version }),
      ...(owner && { owner }),
      ...(reviewCycle && { reviewCycle }),
      ...(approvalAuthority && { approvalAuthority }),
      ...(content && { content }),
      ...(status === 'APPROVED' && { lastReviewedAt: new Date() }),
    },
  });
  await logActivity(req, 'UPDATE', 'DOCUMENT', document.id, document.title, status ? `Status: ${existing.status} → ${status}` : undefined);
  res.json({ document });
}
