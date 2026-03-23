/**
 * One-time migration: update user roles to new model.
 * Run inside backend container: npx tsx migrate-roles.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  const db = new PrismaClient();

  // 1. Get all tenant schemas from platform
  const tenants: Array<{ schema_name: string }> = await db.$queryRaw`
    SELECT schema_name FROM platform."Tenant"
  `;

  console.log(`Found ${tenants.length} tenants`);

  for (const tenant of tenants) {
    const schema = tenant.schema_name;
    console.log(`\nMigrating ${schema}...`);

    // Promote admin@isoai.local to SUPER_ADMIN and update email/password
    const hashedPassword = await bcrypt.hash('KeepMeIso@2026', 12);
    const promoted = await db.$executeRawUnsafe(
      `UPDATE ${schema}."User" SET role = 'SUPER_ADMIN', email = 'support@keepmeiso.com', name = 'Platform Administrator', password = $1 WHERE email = 'admin@isoai.local'`,
      hashedPassword
    );
    if (promoted > 0) console.log(`  Promoted admin@isoai.local → support@keepmeiso.com (SUPER_ADMIN)`);

    // Rename USER → COMPLIANCE_USER
    const renamed = await db.$executeRawUnsafe(
      `UPDATE ${schema}."User" SET role = 'COMPLIANCE_USER' WHERE role = 'USER'`
    );
    if (renamed > 0) console.log(`  Renamed ${renamed} USER → COMPLIANCE_USER`);

    // Log remaining roles
    const roles: Array<{ role: string; count: bigint }> = await db.$queryRawUnsafe(
      `SELECT role, COUNT(*) as count FROM ${schema}."User" GROUP BY role`
    );
    for (const r of roles) {
      console.log(`  ${r.role}: ${r.count}`);
    }
  }

  // Also update PlatformUser
  const hashedPassword = await bcrypt.hash('KeepMeIso@2026', 12);
  await db.$executeRawUnsafe(
    `UPDATE platform."PlatformUser" SET email = 'support@keepmeiso.com', name = 'Platform Administrator', password = $1 WHERE email = 'admin@isoai.local'`,
    hashedPassword
  );
  console.log('\nPlatformUser updated.');

  await db.$disconnect();
  console.log('\nMigration complete.');
}

main().catch(console.error);
