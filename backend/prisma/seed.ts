import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

/**
 * Multi-tenant seed script.
 *
 * 1. Creates platform schema tables (Tenant, PlatformUser, Standard, TenantStandard)
 * 2. Seeds ISO standards into platform.Standard
 * 3. Creates a default tenant and provisions its schema
 * 4. Seeds the default tenant with admin user, control mappings, documents, training
 */

// Platform client — uses platform schema for raw SQL
function buildUrlForSchema(schemaName: string): string {
  const baseUrl = process.env.DATABASE_URL!;
  if (/schema=\w+/.test(baseUrl)) {
    return baseUrl.replace(/schema=\w+/, `schema=${schemaName}`);
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}schema=${schemaName}`;
}

const platformDb = new PrismaClient({
  datasourceUrl: buildUrlForSchema('platform'),
});

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@isoai.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG || 'default';
  const defaultTenantName = process.env.DEFAULT_TENANT_NAME || 'Default Organisation';

  // ============================================================
  // 1. Setup platform schema tables
  // ============================================================
  console.log('Setting up platform schema tables...');

  await platformDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS platform`);

  await platformDb.$executeRawUnsafe(`
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

  await platformDb.$executeRawUnsafe(`
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

  await platformDb.$executeRawUnsafe(`
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

  await platformDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform."TenantStandard" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id TEXT NOT NULL REFERENCES platform."Tenant"(id) ON DELETE CASCADE,
      standard_id TEXT NOT NULL REFERENCES platform."Standard"(id),
      activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, standard_id)
    )
  `);

  console.log('Platform tables ready.');

  // ============================================================
  // 2. Seed ISO Standards
  // ============================================================
  console.log('Seeding ISO standards...');

  const standards = [
    { code: 'ISO_42001', title: 'ISO/IEC 42001:2023 — AI Management Systems', shortTitle: 'AI Management', category: 'CERTIFIABLE', description: 'Requirements for establishing, implementing, maintaining, and continually improving an AI management system within organisations.', controlCount: 23 },
    { code: 'ISO_27001', title: 'ISO/IEC 27001:2022 — Information Security Management', shortTitle: 'Info Security', category: 'CERTIFIABLE', description: 'Requirements for establishing, implementing, maintaining, and continually improving an information security management system.', controlCount: 93 },
    { code: 'ISO_9001', title: 'ISO 9001:2015 — Quality Management', shortTitle: 'Quality', category: 'CERTIFIABLE', description: 'Requirements for a quality management system when an organisation needs to demonstrate its ability to consistently provide products and services.', controlCount: 23 },
    { code: 'ISO_27701', title: 'ISO/IEC 27701:2019 — Privacy Information Management', shortTitle: 'Privacy', category: 'CERTIFIABLE', description: 'Extension to ISO 27001 and ISO 27002 for privacy information management.', controlCount: 49 },
    { code: 'ISO_27017', title: 'ISO/IEC 27017:2015 — Cloud Security', shortTitle: 'Cloud Security', category: 'GUIDANCE', description: 'Guidelines for information security controls applicable to the provision and use of cloud services.', controlCount: 37 },
    { code: 'ISO_27018', title: 'ISO/IEC 27018:2019 — Cloud Privacy', shortTitle: 'Cloud Privacy', category: 'GUIDANCE', description: 'Code of practice for protection of personally identifiable information in public clouds.', controlCount: 25 },
    { code: 'ISO_27002', title: 'ISO/IEC 27002:2022 — Information Security Controls', shortTitle: 'Security Controls', category: 'GUIDANCE', description: 'Reference set of generic information security controls including implementation guidance.', controlCount: 93 },
    { code: 'ISO_22301', title: 'ISO 22301:2019 — Business Continuity', shortTitle: 'Business Continuity', category: 'CERTIFIABLE', description: 'Requirements for planning, establishing, implementing, operating, monitoring, reviewing, maintaining and improving a business continuity management system.', controlCount: 23 },
    { code: 'ISO_20000', title: 'ISO/IEC 20000-1:2018 — IT Service Management', shortTitle: 'ITSM', category: 'CERTIFIABLE', description: 'Requirements for an organisation to establish, implement, maintain, and continually improve a service management system.', controlCount: 23 },
    { code: 'ISO_31000', title: 'ISO 31000:2018 — Risk Management', shortTitle: 'Risk Management', category: 'FRAMEWORK', description: 'Guidelines on managing risk faced by organisations. Can be customised to any context.', controlCount: 0 },
    { code: 'ISO_23894', title: 'ISO/IEC 23894:2023 — AI Risk Management', shortTitle: 'AI Risk', category: 'GUIDANCE', description: 'Guidance on how organisations that develop, produce, deploy or use AI can manage risk specifically related to AI.', controlCount: 0 },
    { code: 'ISO_25024', title: 'ISO/IEC 25024:2015 — Data Quality', shortTitle: 'Data Quality', category: 'GUIDANCE', description: 'Defines data quality measures for quantitatively measuring data quality in terms of characteristics.', controlCount: 0 },
    { code: 'ISO_5338', title: 'ISO/IEC 5338:2023 — AI Lifecycle', shortTitle: 'AI Lifecycle', category: 'GUIDANCE', description: 'Defines AI system lifecycle processes including their activities and tasks.', controlCount: 0 },
    { code: 'ISO_42005', title: 'ISO/IEC 42005:2025 — AI Impact Assessment', shortTitle: 'AI Impact', category: 'GUIDANCE', description: 'Guidance for AI system impact assessments focusing on individuals, groups, and society.', controlCount: 0 },
  ];

  for (const s of standards) {
    await platformDb.$executeRawUnsafe(`
      INSERT INTO platform."Standard" (code, title, short_title, category, description, control_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (code) DO UPDATE SET
        title = EXCLUDED.title,
        short_title = EXCLUDED.short_title,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        control_count = EXCLUDED.control_count
    `, s.code, s.title, s.shortTitle, s.category, s.description, s.controlCount);
  }
  console.log(`Seeded ${standards.length} ISO standards.`);

  // ============================================================
  // 3. Create default tenant and provision schema
  // ============================================================
  const tenantSchemaName = `tenant_${defaultTenantSlug}`;

  // Check if default tenant already exists
  const existingTenants: Array<{ id: string }> = await platformDb.$queryRawUnsafe(
    `SELECT id FROM platform."Tenant" WHERE slug = $1`, defaultTenantSlug
  );

  let tenantId: string;

  if (existingTenants.length === 0) {
    console.log(`Creating default tenant: ${defaultTenantName} (${defaultTenantSlug})...`);
    const newTenants: Array<{ id: string }> = await platformDb.$queryRawUnsafe(`
      INSERT INTO platform."Tenant" (name, slug, schema_name, contact_email, contact_name, plan, max_users)
      VALUES ($1, $2, $3, $4, $5, 'professional', 50)
      RETURNING id
    `, defaultTenantName, defaultTenantSlug, tenantSchemaName, adminEmail, 'System Administrator');
    tenantId = newTenants[0].id;

    // Activate ISO 42001 for the default tenant
    await platformDb.$executeRawUnsafe(`
      INSERT INTO platform."TenantStandard" (tenant_id, standard_id)
      SELECT $1, id FROM platform."Standard" WHERE code = 'ISO_42001'
      ON CONFLICT DO NOTHING
    `, tenantId);
  } else {
    tenantId = existingTenants[0].id;
    console.log('Default tenant already exists, skipping creation.');
  }

  // Provision the tenant schema (clone from tenant_template)
  console.log(`Provisioning tenant schema: ${tenantSchemaName}...`);
  await platformDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${tenantSchemaName}"`);

  const tables: Array<{ tablename: string }> = await platformDb.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'tenant_template'
  `);

  for (const { tablename } of tables) {
    await platformDb.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${tenantSchemaName}"."${tablename}" (LIKE "tenant_template"."${tablename}" INCLUDING ALL)`
    );
  }

  // Copy sequences
  const sequences: Array<{ sequence_name: string }> = await platformDb.$queryRawUnsafe(`
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'tenant_template'
  `);
  for (const { sequence_name } of sequences) {
    try {
      await platformDb.$executeRawUnsafe(
        `CREATE SEQUENCE IF NOT EXISTS "${tenantSchemaName}"."${sequence_name}"`
      );
    } catch {
      // May already exist
    }
  }
  console.log(`Tenant schema ${tenantSchemaName} provisioned (${tables.length} tables).`);

  // ============================================================
  // 4. Seed tenant data using tenant-scoped Prisma client
  // ============================================================
  const tenantDb = new PrismaClient({
    datasourceUrl: buildUrlForSchema(tenantSchemaName),
  });

  try {
    // Seed admin user
    const existing = await tenantDb.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await tenantDb.user.create({
        data: {
          email: adminEmail,
          name: 'System Administrator',
          password: hashedPassword,
          role: 'ADMIN',
        },
      });
      console.log(`Admin user created in ${tenantSchemaName}: ${adminEmail}`);
    } else {
      console.log('Admin user already exists, skipping.');
    }

    // Also create as PlatformUser (TENANT_ADMIN for this tenant)
    const existingPlatformUsers: Array<{ id: string }> = await platformDb.$queryRawUnsafe(
      `SELECT id FROM platform."PlatformUser" WHERE email = $1`, adminEmail
    );
    if (existingPlatformUsers.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await platformDb.$executeRawUnsafe(`
        INSERT INTO platform."PlatformUser" (email, name, password, role, tenant_id)
        VALUES ($1, $2, $3, 'TENANT_ADMIN', $4)
      `, adminEmail, 'System Administrator', hashedPassword, tenantId);
      console.log(`Platform user created: ${adminEmail}`);
    }

    // ============================================================
    // Seed ALL standard control mappings from JSON files
    // ============================================================
    const standardsDir = path.join(__dirname, 'standards');
    let totalControls = 0;

    if (fs.existsSync(standardsDir)) {
      const standardFiles = fs.readdirSync(standardsDir).filter(f => f.endsWith('.json'));

      for (const file of standardFiles) {
        const standardCode = file.replace('.json', ''); // e.g. "ISO_27001"
        const filePath = path.join(standardsDir, file);
        const controls: Array<{ clauseNumber: string; clauseTitle: string; requirement: string }> =
          JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        for (const ctrl of controls) {
          await tenantDb.controlMapping.upsert({
            where: {
              standardCode_clauseNumber: {
                standardCode,
                clauseNumber: ctrl.clauseNumber,
              },
            },
            update: {
              clauseTitle: ctrl.clauseTitle,
              requirement: ctrl.requirement,
            },
            create: {
              standardCode,
              clauseNumber: ctrl.clauseNumber,
              clauseTitle: ctrl.clauseTitle,
              requirement: ctrl.requirement,
            },
          });
        }

        totalControls += controls.length;
        console.log(`  ${standardCode}: ${controls.length} controls`);
      }
    }

    // Also seed ISO 42001 from inline data (in case JSON file doesn't exist)
    const iso42001File = path.join(standardsDir, 'ISO_42001.json');
    if (!fs.existsSync(iso42001File)) {
      const iso42001Controls = [
        { clauseNumber: '4.1', clauseTitle: 'Understanding the Organisation and Its Context', requirement: 'Determine external and internal issues relevant to the AI management system.' },
        { clauseNumber: '4.2', clauseTitle: 'Understanding the Needs and Expectations of Interested Parties', requirement: 'Identify interested parties and their requirements related to AI systems.' },
        { clauseNumber: '4.3', clauseTitle: 'Determining the Scope of the AI Management System', requirement: 'Define the boundaries and applicability of the AIMS.' },
        { clauseNumber: '4.4', clauseTitle: 'AI Management System', requirement: 'Establish, implement, maintain, and continually improve the AIMS.' },
        { clauseNumber: '5.1', clauseTitle: 'Leadership and Commitment', requirement: 'Top management shall demonstrate leadership and commitment to the AIMS.' },
        { clauseNumber: '5.2', clauseTitle: 'AI Policy', requirement: 'Establish an AI policy appropriate to the purpose of the organisation.' },
        { clauseNumber: '5.3', clauseTitle: 'Organisational Roles, Responsibilities and Authorities', requirement: 'Assign and communicate responsibilities and authorities for AI governance roles.' },
        { clauseNumber: '6.1', clauseTitle: 'Actions to Address Risks and Opportunities', requirement: 'Determine risks and opportunities that need to be addressed for the AIMS.' },
        { clauseNumber: '6.2', clauseTitle: 'AI Objectives and Planning to Achieve Them', requirement: 'Establish AI objectives at relevant functions and levels.' },
        { clauseNumber: '7.1', clauseTitle: 'Resources', requirement: 'Determine and provide resources needed for the AIMS.' },
        { clauseNumber: '7.2', clauseTitle: 'Competence', requirement: 'Ensure persons performing AI governance work are competent.' },
        { clauseNumber: '7.3', clauseTitle: 'Awareness', requirement: 'Ensure persons are aware of AI policy and their contribution to AIMS effectiveness.' },
        { clauseNumber: '7.4', clauseTitle: 'Communication', requirement: 'Determine internal and external communications relevant to the AIMS.' },
        { clauseNumber: '7.5', clauseTitle: 'Documented Information', requirement: 'Maintain documented information required by the AIMS.' },
        { clauseNumber: '8.1', clauseTitle: 'Operational Planning and Control', requirement: 'Plan, implement, and control processes needed to meet AIMS requirements.' },
        { clauseNumber: '8.2', clauseTitle: 'AI Risk Assessment', requirement: 'Perform AI risk assessments at planned intervals or when significant changes occur.' },
        { clauseNumber: '8.3', clauseTitle: 'AI Risk Treatment', requirement: 'Implement the AI risk treatment plan and retain documented information.' },
        { clauseNumber: '8.4', clauseTitle: 'AI System Impact Assessment', requirement: 'Assess the impact of AI systems on individuals, groups, and society.' },
        { clauseNumber: '9.1', clauseTitle: 'Monitoring, Measurement, Analysis and Evaluation', requirement: 'Determine what needs to be monitored and measured for the AIMS.' },
        { clauseNumber: '9.2', clauseTitle: 'Internal Audit', requirement: 'Conduct internal audits at planned intervals.' },
        { clauseNumber: '9.3', clauseTitle: 'Management Review', requirement: 'Top management shall review the AIMS at planned intervals.' },
        { clauseNumber: '10.1', clauseTitle: 'Continual Improvement', requirement: 'Continually improve the suitability, adequacy, and effectiveness of the AIMS.' },
        { clauseNumber: '10.2', clauseTitle: 'Nonconformity and Corrective Action', requirement: 'React to nonconformities and take corrective action as applicable.' },
      ];
      for (const ctrl of iso42001Controls) {
        await tenantDb.controlMapping.upsert({
          where: { standardCode_clauseNumber: { standardCode: 'ISO_42001', clauseNumber: ctrl.clauseNumber } },
          update: {},
          create: { standardCode: 'ISO_42001', ...ctrl },
        });
      }
      totalControls += iso42001Controls.length;
      console.log(`  ISO_42001: ${iso42001Controls.length} controls (inline)`);
    }

    console.log(`Seeded ${totalControls} total control mappings across all standards.`);

    // ============================================================
    // Seed Harmonized Requirements (cross-standard deduplication)
    // ============================================================
    // The ISO Harmonized Structure (Annex SL) means clauses 4-10 are
    // shared across certifiable standards. We create HarmonizedRequirement
    // entries and link matching ControlMapping records to them.
    const harmonizedClauses = [
      // Context of the Organisation
      { clauseNumber: 'HLS-4.1', clauseTitle: 'Understanding the Organisation and Its Context', requirement: 'Determine external and internal issues relevant to the management system purpose and strategic direction.', category: 'CONTEXT' },
      { clauseNumber: 'HLS-4.2', clauseTitle: 'Understanding the Needs and Expectations of Interested Parties', requirement: 'Identify interested parties relevant to the management system and their requirements.', category: 'CONTEXT' },
      { clauseNumber: 'HLS-4.3', clauseTitle: 'Determining the Scope of the Management System', requirement: 'Define the boundaries and applicability of the management system.', category: 'CONTEXT' },
      { clauseNumber: 'HLS-4.4', clauseTitle: 'Management System', requirement: 'Establish, implement, maintain, and continually improve the management system including processes and interactions.', category: 'CONTEXT' },
      // Leadership
      { clauseNumber: 'HLS-5.1', clauseTitle: 'Leadership and Commitment', requirement: 'Top management shall demonstrate leadership and commitment with respect to the management system.', category: 'LEADERSHIP' },
      { clauseNumber: 'HLS-5.2', clauseTitle: 'Policy', requirement: 'Top management shall establish a policy appropriate to the purpose of the organisation.', category: 'LEADERSHIP' },
      { clauseNumber: 'HLS-5.3', clauseTitle: 'Organisational Roles, Responsibilities and Authorities', requirement: 'Ensure responsibilities and authorities for relevant roles are assigned, communicated and understood.', category: 'LEADERSHIP' },
      // Planning
      { clauseNumber: 'HLS-6.1', clauseTitle: 'Actions to Address Risks and Opportunities', requirement: 'Determine risks and opportunities that need to be addressed to ensure the management system achieves its intended outcomes.', category: 'PLANNING' },
      { clauseNumber: 'HLS-6.2', clauseTitle: 'Objectives and Planning to Achieve Them', requirement: 'Establish objectives at relevant functions, levels and processes with plans to achieve them.', category: 'PLANNING' },
      // Support
      { clauseNumber: 'HLS-7.1', clauseTitle: 'Resources', requirement: 'Determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the management system.', category: 'SUPPORT' },
      { clauseNumber: 'HLS-7.2', clauseTitle: 'Competence', requirement: 'Determine necessary competence, ensure persons are competent, and take action to acquire the necessary competence.', category: 'SUPPORT' },
      { clauseNumber: 'HLS-7.3', clauseTitle: 'Awareness', requirement: 'Persons doing work under the organisation\'s control shall be aware of the policy, their contribution, and implications of non-conformance.', category: 'SUPPORT' },
      { clauseNumber: 'HLS-7.4', clauseTitle: 'Communication', requirement: 'Determine internal and external communications relevant to the management system.', category: 'SUPPORT' },
      { clauseNumber: 'HLS-7.5', clauseTitle: 'Documented Information', requirement: 'The management system shall include documented information required by the standard and determined necessary for effectiveness.', category: 'SUPPORT' },
      // Operation
      { clauseNumber: 'HLS-8.1', clauseTitle: 'Operational Planning and Control', requirement: 'Plan, implement and control the processes needed to meet requirements and implement actions to address risks and opportunities.', category: 'OPERATION' },
      // Performance Evaluation
      { clauseNumber: 'HLS-9.1', clauseTitle: 'Monitoring, Measurement, Analysis and Evaluation', requirement: 'Determine what needs to be monitored and measured, including methods and when results shall be analysed and evaluated.', category: 'EVALUATION' },
      { clauseNumber: 'HLS-9.2', clauseTitle: 'Internal Audit', requirement: 'Conduct internal audits at planned intervals to confirm the management system conforms to requirements and is effectively implemented.', category: 'EVALUATION' },
      { clauseNumber: 'HLS-9.3', clauseTitle: 'Management Review', requirement: 'Top management shall review the management system at planned intervals to ensure its suitability, adequacy and effectiveness.', category: 'EVALUATION' },
      // Improvement
      { clauseNumber: 'HLS-10.1', clauseTitle: 'Continual Improvement', requirement: 'Continually improve the suitability, adequacy and effectiveness of the management system.', category: 'IMPROVEMENT' },
      { clauseNumber: 'HLS-10.2', clauseTitle: 'Nonconformity and Corrective Action', requirement: 'React to nonconformities, evaluate the need for action, implement corrective action, and review effectiveness.', category: 'IMPROVEMENT' },
    ];

    // Standards that follow the Harmonized Structure (Annex SL)
    const hlsStandards = ['ISO_27001', 'ISO_42001', 'ISO_9001', 'ISO_22301', 'ISO_20000'];

    // Map of HLS clause number to the corresponding clause numbers in each standard
    // Most standards use the same number (e.g., 4.1 maps to 4.1)
    const hlsClauseMap: Record<string, string> = {
      'HLS-4.1': '4.1', 'HLS-4.2': '4.2', 'HLS-4.3': '4.3', 'HLS-4.4': '4.4',
      'HLS-5.1': '5.1', 'HLS-5.2': '5.2', 'HLS-5.3': '5.3',
      'HLS-6.1': '6.1', 'HLS-6.2': '6.2',
      'HLS-7.1': '7.1', 'HLS-7.2': '7.2', 'HLS-7.3': '7.3', 'HLS-7.4': '7.4', 'HLS-7.5': '7.5',
      'HLS-8.1': '8.1',
      'HLS-9.1': '9.1', 'HLS-9.2': '9.2', 'HLS-9.3': '9.3',
      'HLS-10.1': '10.1', 'HLS-10.2': '10.2',
    };

    for (const hc of harmonizedClauses) {
      // Create or update the harmonized requirement
      const hr = await tenantDb.harmonizedRequirement.upsert({
        where: { clauseNumber: hc.clauseNumber },
        update: { clauseTitle: hc.clauseTitle, requirement: hc.requirement, category: hc.category },
        create: hc,
      });

      // Link matching ControlMappings across all HLS standards
      const stdClause = hlsClauseMap[hc.clauseNumber];
      if (stdClause) {
        for (const stdCode of hlsStandards) {
          // Find the control mapping for this standard + clause
          const cm = await tenantDb.controlMapping.findUnique({
            where: { standardCode_clauseNumber: { standardCode: stdCode, clauseNumber: stdClause } },
          });
          if (cm && !cm.harmonizedGroupId) {
            await tenantDb.controlMapping.update({
              where: { id: cm.id },
              data: { harmonizedGroupId: hr.id },
            });
          }
        }
      }
    }
    console.log(`Seeded ${harmonizedClauses.length} harmonized requirements, linked to ${hlsStandards.length} standards.`);

    // Seed governance documents
    const documentsDir = path.join(__dirname, 'documents');
    const documentMeta: Array<{
      filename: string;
      title: string;
      slug: string;
      documentType: string;
      owner: string;
      reviewCycle: string;
      approvalAuthority: string;
    }> = [
      { filename: 'AI Governance Policy.md', title: 'AI Governance Policy', slug: 'ai-governance-policy', documentType: 'POLICY', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'Managing Director' },
      { filename: 'Artificial Intelligence Management System (AIMS) Manual.md', title: 'Artificial Intelligence Management System (AIMS) Manual', slug: 'aims-manual', documentType: 'MANUAL', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'Managing Director' },
      { filename: 'AI Roles and Responsibilities.md', title: 'AI Roles and Responsibilities', slug: 'ai-roles-and-responsibilities', documentType: 'STANDARD', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'AI Governance Lead' },
      { filename: 'AI Risk Management Framework.md', title: 'AI Risk Management Framework', slug: 'ai-risk-management-framework', documentType: 'FRAMEWORK', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'Managing Director' },
      { filename: 'AI Risk Register.md', title: 'AI Risk Register', slug: 'ai-risk-register', documentType: 'REGISTER', owner: 'AI Governance Lead', reviewCycle: 'Quarterly', approvalAuthority: 'AI Governance Lead' },
      { filename: 'AI System Inventory Standard.md', title: 'AI System Inventory Standard', slug: 'ai-system-inventory-standard', documentType: 'STANDARD', owner: 'Technical Architecture Lead', reviewCycle: 'Annual', approvalAuthority: 'AI Governance Lead' },
      { filename: 'AI System Lifecycle Procedure.md', title: 'AI System Lifecycle Procedure', slug: 'ai-system-lifecycle-procedure', documentType: 'PROCEDURE', owner: 'Technical Architecture Lead', reviewCycle: 'Annual', approvalAuthority: 'AI Governance Lead' },
      { filename: 'Human Oversight Framework for Artificial Intelligence Systems.md', title: 'Human Oversight Framework for AI Systems', slug: 'human-oversight-framework', documentType: 'FRAMEWORK', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'Managing Director' },
      { filename: 'AI Incident Management Procedure.md', title: 'AI Incident Management Procedure', slug: 'ai-incident-management-procedure', documentType: 'PROCEDURE', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'AI Governance Lead' },
      { filename: 'AI Monitoring and Performance Review Procedure.md', title: 'AI Monitoring and Performance Review Procedure', slug: 'ai-monitoring-performance-review', documentType: 'PROCEDURE', owner: 'Operational Reviewer', reviewCycle: 'Annual', approvalAuthority: 'AI Governance Lead' },
      { filename: 'AI Training and Competence Policy.md', title: 'AI Training and Competence Policy', slug: 'ai-training-competence-policy', documentType: 'POLICY', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'Managing Director' },
      { filename: 'Internal Audit and Management Review Procedure.md', title: 'Internal Audit and Management Review Procedure', slug: 'internal-audit-management-review', documentType: 'PROCEDURE', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'Managing Director' },
      { filename: 'ISO-IEC 42001 Control Mapping.md', title: 'ISO/IEC 42001 Control Mapping', slug: 'iso-42001-control-mapping', documentType: 'CONTROL_MAPPING', owner: 'AI Governance Lead', reviewCycle: 'Annual', approvalAuthority: 'Managing Director' },
    ];

    if (fs.existsSync(documentsDir)) {
      for (const doc of documentMeta) {
        const filePath = path.join(documentsDir, doc.filename);
        if (!fs.existsSync(filePath)) {
          console.log(`Document file not found: ${doc.filename}, skipping.`);
          continue;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        await tenantDb.document.upsert({
          where: { slug: doc.slug },
          update: { content },
          create: {
            title: doc.title,
            slug: doc.slug,
            documentType: doc.documentType,
            content,
            owner: doc.owner,
            reviewCycle: doc.reviewCycle,
            approvalAuthority: doc.approvalAuthority,
            version: '1.0',
            status: 'APPROVED',
            lastReviewedAt: new Date(),
          },
        });
      }
      console.log(`Seeded ${documentMeta.length} governance documents.`);
    } else {
      console.log('Documents directory not found, skipping document seeding.');
    }

    // Seed training modules from all training-modules*.json files
    const trainingFiles = fs.readdirSync(__dirname)
      .filter(f => f.startsWith('training-modules') && f.endsWith('.json'))
      .sort();

    let totalModulesSeeded = 0;
    for (const file of trainingFiles) {
      const filePath = path.join(__dirname, file);
      const modules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const mod of modules) {
        await tenantDb.trainingModule.upsert({
          where: { slug: mod.slug },
          update: {
            title: mod.title,
            description: mod.description,
            durationMinutes: mod.durationMinutes,
            sections: typeof mod.sections === 'string' ? mod.sections : JSON.stringify(mod.sections),
            standardCode: mod.standardCode || null,
          },
          create: {
            slug: mod.slug,
            title: mod.title,
            description: mod.description,
            durationMinutes: mod.durationMinutes,
            sections: typeof mod.sections === 'string' ? mod.sections : JSON.stringify(mod.sections),
            standardCode: mod.standardCode || null,
          },
        });
      }
      totalModulesSeeded += modules.length;
      console.log(`  ${file}: ${modules.length} modules`);
    }
    console.log(`Seeded ${totalModulesSeeded} total training modules.`);

  } finally {
    await tenantDb.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await platformDb.$disconnect();
  });
