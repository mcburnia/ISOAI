import { PrismaClient } from '@prisma/client';

// Cache of tenant Prisma clients keyed by schema name
const tenantClients = new Map<string, PrismaClient>();

// Platform client — connects with search_path=platform for raw SQL operations
let _platformClient: PrismaClient | null = null;

function getBaseUrl(): string {
  return process.env.DATABASE_URL!;
}

function buildUrlForSchema(schemaName: string): string {
  const baseUrl = getBaseUrl();
  // Replace schema=xxx or append if not present
  if (/schema=\w+/.test(baseUrl)) {
    return baseUrl.replace(/schema=\w+/, `schema=${schemaName}`);
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}schema=${schemaName}`;
}

/**
 * Get the platform-level Prisma client.
 * Use ONLY with $queryRaw / $executeRaw for platform tables
 * (Tenant, PlatformUser, Standard, TenantStandard).
 * Prisma models are NOT defined for platform tables — they're raw SQL only.
 */
export function getPlatformDb(): PrismaClient {
  if (!_platformClient) {
    _platformClient = new PrismaClient({
      datasourceUrl: buildUrlForSchema('platform'),
    });
  }
  return _platformClient;
}

/**
 * Get a tenant-scoped Prisma client.
 * Creates a new PrismaClient with search_path set to the tenant's schema.
 * All Prisma model operations route to this schema automatically.
 */
export function getTenantDb(schemaName: string): PrismaClient {
  if (tenantClients.has(schemaName)) {
    return tenantClients.get(schemaName)!;
  }

  const client = new PrismaClient({
    datasourceUrl: buildUrlForSchema(schemaName),
  });

  tenantClients.set(schemaName, client);
  return client;
}

/**
 * Provision a new tenant schema by cloning tenant_template.
 * This creates a new PostgreSQL schema with all the tenant tables.
 */
export async function provisionTenantSchema(schemaName: string): Promise<void> {
  const db = getPlatformDb();

  // Create the new schema
  await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // Get the list of tables in tenant_template
  const tables: Array<{ tablename: string }> = await db.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'tenant_template'
  `);

  // Copy each table structure (without data) from tenant_template
  for (const { tablename } of tables) {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tablename}" (LIKE "tenant_template"."${tablename}" INCLUDING ALL)`
    );
  }

  // Copy sequences and reset them
  const sequences: Array<{ sequence_name: string }> = await db.$queryRawUnsafe(`
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'tenant_template'
  `);

  for (const { sequence_name } of sequences) {
    try {
      await db.$executeRawUnsafe(
        `CREATE SEQUENCE IF NOT EXISTS "${schemaName}"."${sequence_name}"`
      );
    } catch {
      // Sequence may already exist from INCLUDING ALL
    }
  }

  console.log(`Provisioned tenant schema: ${schemaName} (${tables.length} tables cloned)`);
}

/**
 * Drop a tenant schema (for cleanup/deletion).
 */
export async function dropTenantSchema(schemaName: string): Promise<void> {
  // Remove cached client
  const client = tenantClients.get(schemaName);
  if (client) {
    await client.$disconnect();
    tenantClients.delete(schemaName);
  }

  await getPlatformDb().$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  console.log(`Dropped tenant schema: ${schemaName}`);
}

/**
 * Disconnect all clients on shutdown.
 */
export async function disconnectAll(): Promise<void> {
  if (_platformClient) {
    await _platformClient.$disconnect();
    _platformClient = null;
  }
  for (const [, client] of tenantClients) {
    await client.$disconnect();
  }
  tenantClients.clear();
}
