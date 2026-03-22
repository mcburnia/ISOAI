import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  createTenant,
  findTenantBySlug,
  listTenants,
  updateTenant,
  listStandards,
  upsertStandard,
  activateStandardForTenant,
  getTenantStandards,
  findTenantById,
} from '../../services/platformDb';
import { provisionTenantSchema, getTenantDb } from '../../services/tenantManager';

// ============================================================
// Tenant Management
// ============================================================

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  contactEmail: z.string().email(),
  contactName: z.string().min(1),
  plan: z.enum(['starter', 'professional', 'enterprise', 'onpremise']).optional(),
  maxUsers: z.number().int().positive().optional(),
  domain: z.string().optional(),
  adminEmail: z.string().email().optional(),
  adminName: z.string().optional(),
  adminPassword: z.string().min(6).optional(),
});

export async function createTenantHandler(req: Request, res: Response): Promise<void> {
  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const schemaName = `tenant_${data.slug.replace(/-/g, '_')}`;

  // Check if slug already taken
  const existing = await findTenantBySlug(data.slug);
  if (existing) {
    res.status(409).json({ error: 'Tenant slug already exists' });
    return;
  }

  // Create tenant record in platform
  const tenant = await createTenant({
    name: data.name,
    slug: data.slug,
    schemaName,
    contactEmail: data.contactEmail,
    contactName: data.contactName,
    plan: data.plan,
    maxUsers: data.maxUsers,
    domain: data.domain,
  });

  // Provision the tenant's database schema
  await provisionTenantSchema(schemaName);

  // Create admin user in the tenant schema if credentials provided
  if (data.adminEmail && data.adminPassword) {
    const tenantDb = getTenantDb(schemaName);
    const hashedPassword = await bcrypt.hash(data.adminPassword, 12);
    await tenantDb.user.create({
      data: {
        email: data.adminEmail,
        name: data.adminName || data.contactName,
        password: hashedPassword,
        role: 'ADMIN',
        mustChangePassword: true,
      },
    });
  }

  res.status(201).json({ tenant });
}

export async function listTenantsHandler(_req: Request, res: Response): Promise<void> {
  const tenants = await listTenants();
  res.json({ tenants });
}

export async function getTenantHandler(req: Request, res: Response): Promise<void> {
  const tenant = await findTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const standards = await getTenantStandards(tenant.id);
  res.json({ tenant, standards });
}

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise', 'onpremise']).optional(),
  maxUsers: z.number().int().positive().optional(),
  domain: z.string().optional(),
});

export async function updateTenantHandler(req: Request, res: Response): Promise<void> {
  const parsed = updateTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const tenant = await findTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const updated = await updateTenant(tenant.id, {
    name: parsed.data.name,
    status: parsed.data.status,
    plan: parsed.data.plan,
    max_users: parsed.data.maxUsers,
    domain: parsed.data.domain,
  });

  res.json({ tenant: updated });
}

// ============================================================
// Standards Management
// ============================================================

export async function listStandardsHandler(_req: Request, res: Response): Promise<void> {
  const standards = await listStandards();
  res.json({ standards });
}

const activateStandardSchema = z.object({
  standardCode: z.string().min(1),
});

export async function activateStandardHandler(req: Request, res: Response): Promise<void> {
  const parsed = activateStandardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const tenant = await findTenantById(req.params.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const { findStandardByCode } = await import('../../services/platformDb');
  const standard = await findStandardByCode(parsed.data.standardCode);
  if (!standard) {
    res.status(404).json({ error: 'Standard not found' });
    return;
  }

  const ts = await activateStandardForTenant(tenant.id, standard.id);
  res.status(201).json({ tenantStandard: ts });
}

export async function getTenantStandardsHandler(req: Request, res: Response): Promise<void> {
  const tenant = await findTenantById(req.params.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const standards = await getTenantStandards(tenant.id);
  res.json({ standards });
}
