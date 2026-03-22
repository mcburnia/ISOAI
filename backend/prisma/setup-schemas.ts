/**
 * Pre-migration setup: creates the PostgreSQL schemas that Prisma
 * and the platform need. Must run BEFORE prisma migrate deploy.
 *
 * - tenant_template: where Prisma creates its managed models
 * - platform: where platform-level tables live (managed by raw SQL)
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  // Connect to the database without schema qualification
  // (just the base database, defaulting to 'public' schema)
  const baseUrl = process.env.DATABASE_URL?.replace(/\?.*$/, '') || process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    datasourceUrl: baseUrl,
  });

  try {
    console.log('Creating database schemas...');
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS tenant_template');
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS platform');
    console.log('Schemas created: tenant_template, platform');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Schema setup failed:', e);
  process.exit(1);
});
