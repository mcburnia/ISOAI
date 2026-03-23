/**
 * Apply assessment models migration to all existing tenant schemas.
 * Run inside backend container: npx tsx migrate-tenants-assessment.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const db = new PrismaClient();

  const tenants: Array<{ schema_name: string }> = await db.$queryRaw`
    SELECT schema_name FROM platform."Tenant"
  `;

  console.log(`Applying assessment migration to ${tenants.length} tenant schemas...`);

  for (const tenant of tenants) {
    const schema = tenant.schema_name;
    if (schema === 'tenant_template') continue; // Already migrated by Prisma
    console.log(`\nMigrating ${schema}...`);

    try {
      // Add passThreshold to TrainingModule
      await db.$executeRawUnsafe(`ALTER TABLE ${schema}."TrainingModule" ADD COLUMN IF NOT EXISTS "passThreshold" INTEGER NOT NULL DEFAULT 80`);

      // Create AssessmentQuestion table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${schema}."AssessmentQuestion" (
          "id" TEXT NOT NULL,
          "moduleId" TEXT NOT NULL,
          "question" TEXT NOT NULL,
          "options" TEXT NOT NULL,
          "correctIndex" INTEGER NOT NULL,
          "explanation" TEXT,
          "hint" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
        )
      `);

      // Create AssessmentAttempt table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${schema}."AssessmentAttempt" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "moduleId" TEXT NOT NULL,
          "score" INTEGER NOT NULL,
          "totalQuestions" INTEGER NOT NULL,
          "correctCount" INTEGER NOT NULL,
          "passed" BOOLEAN NOT NULL,
          "answers" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
        )
      `);

      // Create CompetenceCheck table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${schema}."CompetenceCheck" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "questionId" TEXT NOT NULL,
          "moduleId" TEXT NOT NULL,
          "selectedIndex" INTEGER NOT NULL,
          "correct" BOOLEAN NOT NULL,
          "usedHint" BOOLEAN NOT NULL DEFAULT false,
          "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CompetenceCheck_pkey" PRIMARY KEY ("id")
        )
      `);

      // Indexes
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssessmentQuestion_moduleId_idx" ON ${schema}."AssessmentQuestion"("moduleId")`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssessmentAttempt_userId_moduleId_idx" ON ${schema}."AssessmentAttempt"("userId", "moduleId")`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CompetenceCheck_userId_idx" ON ${schema}."CompetenceCheck"("userId")`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CompetenceCheck_userId_moduleId_idx" ON ${schema}."CompetenceCheck"("userId", "moduleId")`);

      // Foreign keys (use IF NOT EXISTS pattern via exception handling)
      const fkeys = [
        { name: 'AssessmentQuestion_moduleId_fkey', table: 'AssessmentQuestion', sql: `FOREIGN KEY ("moduleId") REFERENCES ${schema}."TrainingModule"("id") ON DELETE CASCADE` },
        { name: 'AssessmentAttempt_userId_fkey', table: 'AssessmentAttempt', sql: `FOREIGN KEY ("userId") REFERENCES ${schema}."User"("id") ON DELETE RESTRICT` },
        { name: 'AssessmentAttempt_moduleId_fkey', table: 'AssessmentAttempt', sql: `FOREIGN KEY ("moduleId") REFERENCES ${schema}."TrainingModule"("id") ON DELETE CASCADE` },
        { name: 'CompetenceCheck_userId_fkey', table: 'CompetenceCheck', sql: `FOREIGN KEY ("userId") REFERENCES ${schema}."User"("id") ON DELETE RESTRICT` },
        { name: 'CompetenceCheck_questionId_fkey', table: 'CompetenceCheck', sql: `FOREIGN KEY ("questionId") REFERENCES ${schema}."AssessmentQuestion"("id") ON DELETE CASCADE` },
        { name: 'CompetenceCheck_moduleId_fkey', table: 'CompetenceCheck', sql: `FOREIGN KEY ("moduleId") REFERENCES ${schema}."TrainingModule"("id") ON DELETE CASCADE` },
      ];

      for (const fk of fkeys) {
        try {
          await db.$executeRawUnsafe(`ALTER TABLE ${schema}."${fk.table}" ADD CONSTRAINT "${fk.name}" ${fk.sql}`);
        } catch {
          // Constraint already exists
        }
      }

      console.log(`  ✓ Done`);
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  await db.$disconnect();
  console.log('\nTenant migration complete.');
}

main().catch(console.error);
