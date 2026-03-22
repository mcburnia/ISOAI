import { getPlatformDb } from './tenantManager';
import { Prisma } from '@prisma/client';

/**
 * Type-safe wrappers for platform schema operations.
 * Platform tables (Tenant, PlatformUser, Standard, TenantStandard)
 * are NOT Prisma-managed models — they're created via raw SQL
 * and queried via $queryRaw/$executeRaw.
 */

// ============================================================
// Platform Types
// ============================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  schema_name: string;
  domain: string | null;
  logo_url: string | null;
  plan: string;
  status: string;
  max_users: number;
  contact_email: string;
  contact_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string; // SUPER_ADMIN, TENANT_ADMIN
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Standard {
  id: string;
  code: string;
  title: string;
  short_title: string;
  category: string; // CERTIFIABLE, GUIDANCE, FRAMEWORK
  description: string;
  control_count: number;
  is_active: boolean;
  created_at: Date;
}

export interface TenantStandard {
  id: string;
  tenant_id: string;
  standard_id: string;
  activated_at: Date;
}

// ============================================================
// Setup — Create platform schema and tables
// ============================================================

export async function setupPlatformSchema(): Promise<void> {
  const db = getPlatformDb();

  // Create platform schema
  await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS platform`);

  // Create platform tables
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform."Tenant" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      schema_name TEXT NOT NULL UNIQUE,
      domain TEXT,
      logo_url TEXT,
      plan TEXT NOT NULL DEFAULT 'starter',
      status TEXT NOT NULL DEFAULT 'active',
      max_users INTEGER NOT NULL DEFAULT 5,
      contact_email TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform."PlatformUser" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'TENANT_ADMIN',
      tenant_id TEXT REFERENCES platform."Tenant"(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform."Standard" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      short_title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      control_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform."TenantStandard" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id TEXT NOT NULL REFERENCES platform."Tenant"(id) ON DELETE CASCADE,
      standard_id TEXT NOT NULL REFERENCES platform."Standard"(id),
      activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, standard_id)
    )
  `);

  console.log('Platform schema and tables created.');
}

// ============================================================
// Tenant Operations
// ============================================================

export async function createTenant(data: {
  name: string;
  slug: string;
  schemaName: string;
  contactEmail: string;
  contactName: string;
  plan?: string;
  maxUsers?: number;
  domain?: string;
}): Promise<Tenant> {
  const db = getPlatformDb();
  const rows: Tenant[] = await db.$queryRawUnsafe(`
    INSERT INTO platform."Tenant" (name, slug, schema_name, contact_email, contact_name, plan, max_users, domain)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, data.name, data.slug, data.schemaName, data.contactEmail, data.contactName,
    data.plan || 'starter', data.maxUsers || 5, data.domain || null);
  return rows[0];
}

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  const db = getPlatformDb();
  const rows: Tenant[] = await db.$queryRawUnsafe(`
    SELECT * FROM platform."Tenant" WHERE slug = $1
  `, slug);
  return rows[0] || null;
}

export async function findTenantById(id: string): Promise<Tenant | null> {
  const db = getPlatformDb();
  const rows: Tenant[] = await db.$queryRawUnsafe(`
    SELECT * FROM platform."Tenant" WHERE id = $1
  `, id);
  return rows[0] || null;
}

export async function listTenants(): Promise<Tenant[]> {
  const db = getPlatformDb();
  return db.$queryRawUnsafe(`SELECT * FROM platform."Tenant" ORDER BY name`);
}

export async function updateTenant(id: string, data: Partial<Pick<Tenant, 'name' | 'status' | 'plan' | 'max_users' | 'domain' | 'logo_url'>>): Promise<Tenant> {
  const db = getPlatformDb();
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(data.name); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(data.status); }
  if (data.plan !== undefined) { sets.push(`plan = $${idx++}`); vals.push(data.plan); }
  if (data.max_users !== undefined) { sets.push(`max_users = $${idx++}`); vals.push(data.max_users); }
  if (data.domain !== undefined) { sets.push(`domain = $${idx++}`); vals.push(data.domain); }
  if (data.logo_url !== undefined) { sets.push(`logo_url = $${idx++}`); vals.push(data.logo_url); }
  sets.push(`updated_at = now()`);

  vals.push(id);
  const rows: Tenant[] = await db.$queryRawUnsafe(
    `UPDATE platform."Tenant" SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    ...vals
  );
  return rows[0];
}

// ============================================================
// Standard Operations
// ============================================================

export async function upsertStandard(data: {
  code: string;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  controlCount?: number;
}): Promise<Standard> {
  const db = getPlatformDb();
  const rows: Standard[] = await db.$queryRawUnsafe(`
    INSERT INTO platform."Standard" (code, title, short_title, category, description, control_count)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (code) DO UPDATE SET
      title = EXCLUDED.title,
      short_title = EXCLUDED.short_title,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      control_count = EXCLUDED.control_count
    RETURNING *
  `, data.code, data.title, data.shortTitle, data.category, data.description, data.controlCount || 0);
  return rows[0];
}

export async function listStandards(): Promise<Standard[]> {
  const db = getPlatformDb();
  return db.$queryRawUnsafe(`SELECT * FROM platform."Standard" WHERE is_active = true ORDER BY code`);
}

export async function findStandardByCode(code: string): Promise<Standard | null> {
  const db = getPlatformDb();
  const rows: Standard[] = await db.$queryRawUnsafe(`
    SELECT * FROM platform."Standard" WHERE code = $1
  `, code);
  return rows[0] || null;
}

// ============================================================
// TenantStandard Operations
// ============================================================

export async function activateStandardForTenant(tenantId: string, standardId: string): Promise<TenantStandard> {
  const db = getPlatformDb();
  const rows: TenantStandard[] = await db.$queryRawUnsafe(`
    INSERT INTO platform."TenantStandard" (tenant_id, standard_id)
    VALUES ($1, $2)
    ON CONFLICT (tenant_id, standard_id) DO NOTHING
    RETURNING *
  `, tenantId, standardId);
  return rows[0];
}

export async function getTenantStandards(tenantId: string): Promise<(TenantStandard & { standard: Standard })[]> {
  const db = getPlatformDb();
  return db.$queryRawUnsafe(`
    SELECT ts.*, row_to_json(s.*) as standard
    FROM platform."TenantStandard" ts
    JOIN platform."Standard" s ON s.id = ts.standard_id
    WHERE ts.tenant_id = $1
    ORDER BY s.code
  `, tenantId);
}

// ============================================================
// PlatformUser Operations
// ============================================================

export async function findPlatformUserByEmail(email: string): Promise<PlatformUser | null> {
  const db = getPlatformDb();
  const rows: PlatformUser[] = await db.$queryRawUnsafe(`
    SELECT * FROM platform."PlatformUser" WHERE email = $1
  `, email);
  return rows[0] || null;
}

export async function createPlatformUser(data: {
  email: string;
  name: string;
  password: string;
  role: string;
  tenantId?: string;
}): Promise<PlatformUser> {
  const db = getPlatformDb();
  const rows: PlatformUser[] = await db.$queryRawUnsafe(`
    INSERT INTO platform."PlatformUser" (email, name, password, role, tenant_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, data.email, data.name, data.password, data.role, data.tenantId || null);
  return rows[0];
}

/**
 * Find tenant by user email — looks up which tenant a user belongs to.
 * Used during login to resolve tenant context.
 */
export async function findTenantForUserEmail(email: string): Promise<Tenant | null> {
  const db = getPlatformDb();
  // Check PlatformUser first
  const platformUser = await findPlatformUserByEmail(email);
  if (platformUser?.tenant_id) {
    return findTenantById(platformUser.tenant_id);
  }
  return null;
}
