import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma, tenantSchemaStore } from '../../prisma';
import { env } from '../../config/env';
import { logActivity } from '../../services/auditLog';
import { findTenantBySlug, findTenantForUserEmail } from '../../services/platformDb';
import { getTenantDb } from '../../services/tenantManager';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantSlug: z.string().optional(), // Optional — resolved from header or default
});

/**
 * Resolve which tenant schema to use for unauthenticated routes.
 * Priority: 1) request body, 2) X-Tenant-Slug header, 3) default tenant
 */
function resolveTenantSlug(req: Request, bodySlug?: string): string {
  return bodySlug
    || (req.headers['x-tenant-slug'] as string)
    || env.defaultTenantSlug;
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { email, name, password } = parsed.data;

  // Resolve tenant
  const slug = resolveTenantSlug(req);
  const tenant = await findTenantBySlug(slug);
  if (!tenant) {
    res.status(400).json({ error: 'Invalid tenant' });
    return;
  }

  // Use the tenant's schema
  const tenantDb = getTenantDb(tenant.schema_name);

  const existing = await tenantDb.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await tenantDb.user.create({
    data: { email, name, password: hashedPassword },
  });

  const token = jwt.sign(
    { userId: user.id, role: user.role, tenantId: tenant.id, schemaName: tenant.schema_name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const { email, password, tenantSlug } = parsed.data;

  // Resolve tenant
  const slug = resolveTenantSlug(req, tenantSlug);
  const tenant = await findTenantBySlug(slug);
  if (!tenant) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (tenant.status !== 'active') {
    res.status(403).json({ error: 'This organisation account is suspended' });
    return;
  }

  // Query user in the tenant's schema
  const tenantDb = getTenantDb(tenant.schema_name);
  const user = await tenantDb.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, tenantId: tenant.id, schemaName: tenant.schema_name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  // Log login — enter tenant context for the audit log
  req.user = { userId: user.id, role: user.role, tenantId: tenant.id, schemaName: tenant.schema_name };
  await tenantSchemaStore.run(tenant.schema_name, () =>
    logActivity(req, 'LOGIN', 'AUTH', user.id, user.name)
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    mustChangePassword: user.mustChangePassword,
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true, mustChangePassword: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Include tenant info if available
  let tenantInfo = null;
  if (req.user?.tenantId) {
    const tenant = await findTenantBySlug(env.defaultTenantSlug);
    if (tenant && tenant.id === req.user.tenantId) {
      tenantInfo = { id: tenant.id, name: tenant.name, slug: tenant.slug };
    } else {
      // Look up by ID
      const { findTenantById } = await import('../../services/platformDb');
      const t = await findTenantById(req.user.tenantId);
      if (t) tenantInfo = { id: t.id, name: t.name, slug: t.slug };
    }
  }

  res.json({ user, tenant: tenantInfo });
}

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

export async function changePassword(req: Request, res: Response): Promise<void> {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, mustChangePassword: false },
  });

  await logActivity(req, 'CHANGE_PASSWORD', 'AUTH', user.id, user.name);
  res.json({ message: 'Password changed successfully' });
}

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { name, email } = parsed.data;

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.user!.userId) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(name && { name }),
      ...(email && { email }),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  res.json({ user });
}

const forceChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

export async function forceChangePassword(req: Request, res: Response): Promise<void> {
  const parsed = forceChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (!user.mustChangePassword) {
    res.status(400).json({ error: 'Password change is not required' });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'New password must be different from the temporary password' });
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, mustChangePassword: false },
  });

  // Issue a fresh token with tenant context
  const token = jwt.sign(
    { userId: user.id, role: user.role, tenantId: req.user?.tenantId, schemaName: req.user?.schemaName },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  await logActivity(req, 'FORCE_CHANGE_PASSWORD', 'AUTH', user.id, user.name);

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    message: 'Password changed successfully',
  });
}
