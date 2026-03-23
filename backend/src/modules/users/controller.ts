import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { sendInvitationEmail } from '../../services/email';
import { logActivity } from '../../services/auditLog';

const updateRoleSchema = z.object({
  role: z.enum(['COMPLIANCE_USER', 'AUDITOR', 'ADMIN']),
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['COMPLIANCE_USER', 'AUDITOR', 'ADMIN']).optional().default('COMPLIANCE_USER'),
});

export async function createUser(req: Request, res: Response): Promise<void> {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { email, name, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword, role, mustChangePassword: true },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  // Send invitation email with temporary password
  const emailResult = await sendInvitationEmail(email, name, password);

  await logActivity(req, 'CREATE', 'USER', user.id, user.name, `Role: ${user.role}, Email: ${user.email}`);

  res.status(201).json({
    user,
    emailSent: emailResult.sent,
    emailError: emailResult.sent ? undefined : emailResult.error,
  });
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json({ users });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid role. Must be COMPLIANCE_USER, AUDITOR, or ADMIN.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.role === 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Cannot modify a platform administrator' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, name: true, role: true },
  });

  await logActivity(req, 'UPDATE', 'USER', updated.id, updated.name, `Role: ${user.role} → ${updated.role}`);
  res.json({ user: updated });
}
