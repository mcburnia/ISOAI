# RESTART.md — Keep Me ISO

Last updated: 2026-03-23

## Architecture

### Overview

Three-service Docker Compose stack: PostgreSQL 16, Node.js/Express backend, Vite/React frontend. Accessible at https://keepmeiso.com via Cloudflare Tunnel.

### Multi-Tenancy

- **Schema-per-tenant isolation** — each tenant gets its own PostgreSQL schema cloned from `tenant_template`
- **AsyncLocalStorage-based routing** — transparent Prisma proxy routes queries to the correct tenant schema based on request context
- **Platform schema** — stores tenant metadata (`platform."Tenant"`), standards catalogue (`platform."Standard"`), and tenant-standard activation (`platform."TenantStandard"`)
- Tenant creation clones `tenant_template` schema (includes all tables, seed data for 640 controls and 41 training modules)
- **Per-tenant standard selection** — org admins choose which ISO certifications to pursue; compliance, training, and dashboard views filter to show only activated standards

### Access Tiers

- **SUPER_ADMIN** (Platform Admin) — manages tenants, onboards organisations. Only assignable via seed/database. Currently `support@keepmeiso.com`.
- **ADMIN** (Organisation Admin) — manages users, activates standards, configures scheduling, manages questions. Sees Admin section in sidebar.
- **AUDITOR** — read-only across all modules. Cannot create, edit, or delete. Backend returns 403 on write attempts via `requireComplianceUser` middleware.
- **COMPLIANCE_USER** — standard working role. Can create/edit compliance records but no admin access. Default role for new users.

Deployment mode (`env.deploymentMode`): SaaS (SUPER_ADMIN only for platform routes) or self-hosted (ADMIN can also access platform routes).

### Database

PostgreSQL 16 with Prisma ORM. Key models:

- **User** — JWT auth with bcrypt, forced password reset, roles: SUPER_ADMIN/ADMIN/AUDITOR/COMPLIANCE_USER
- **AISystem** — inventory with risk classification, deployment status, review dates
- **Risk** — register with category, likelihood, impact, mitigation
- **LifecycleEntry** — 7-stage pipeline per system
- **Incident** — severity, status workflow, corrective actions
- **OversightRecord** — human oversight reviews per system
- **MonitoringRecord** — performance monitoring per system
- **TrainingModule** — 41 modules across 14 standards with content sections, passThreshold (default 80%)
- **TrainingRecord** — per-user completion records with score evidence
- **AssessmentQuestion** — multiple-choice questions per module with options, correctIndex, explanation, hint
- **AssessmentAttempt** — scored assessment attempts per user per module
- **CompetenceCheck** — ongoing retention verification answers with usedHint tracking
- **ScheduledObligation** — recurring compliance obligations (11 types) with frequency, assignee, linked entity
- **ObligationInstance** — individual occurrences of obligations with due date, completion, status
- **Audit / AuditFinding** — internal audit with findings and corrective actions
- **ManagementReview** — review records
- **GovernanceRole** — role assignments (5 governance roles, optionally per-system)
- **ControlMapping** — 640 controls across 14 standards with status tracking
- **HarmonizedRequirement** — 20 HLS requirements linking 5 certifiable standards (clauses 4-10)
- **Document** — 13 seeded governance documents
- **ActivityLog** — audit trail for all CRUD operations

### Standards Covered (14)

ISO 42001, 27001, 9001, 27701, 27017, 27018, 27002, 22301, 20000-1, 31000, 23894, 25024, 5338, 42005

### Frontend

React + TypeScript + Tailwind CSS. Key pages:

- Dashboard — KPI cards, per-standard compliance, risk breakdown, training completion, competence check banner, recent activity
- AI Systems — inventory CRUD with detail views
- Risk Register — CRUD with system filtering
- Lifecycle — stage pipeline view
- Incidents — CRUD with severity/status workflow
- Human Oversight — review records
- Monitoring — performance records
- Policy Documents — 13 governance documents with markdown rendering
- Roles & Responsibilities — governance role assignments
- Training — 41 modules grouped by standard, section-by-section reading with acknowledgement, post-training assessment quiz, completion tracking
- Training QuestionBank — admin page for managing assessment questions per module, configurable pass threshold
- Scheduling — obligation management with complete/skip workflows, summary cards
- Audits & Reviews — audit CRUD, findings, management reviews
- Control Mapping — 14-standard selector, status filters, collapsible clause sections, inline editing, HLS badges
- Activity Log — full audit trail
- Settings — user profile, organisation info, active standards summary
- Admin > User Management — user CRUD with role dropdown (ADMIN/AUDITOR/COMPLIANCE_USER), email invitation
- Admin > Standards — per-tenant standard activation with "Learn more" descriptions
- Admin > Competence — competence dashboard with per-user scores, hint usage, frequency, flagged users
- Platform > Organisations — tenant management (create, suspend, reactivate, cancel) — SUPER_ADMIN only

### Brand

Product brand: Keep Me ISO (KMI). Text logo: KEEP**ME**ISO.COM with coral accent. Enterprise trust palette: navy primary (#0F3D7C), coral accent (#F97316), indigo secondary (#2E4A71), clean grey background (#F5F7FA), slate text (#2D3748). Tailwind token prefix: `kmi-`.

### Infrastructure

- **Domain:** keepmeiso.com (Cloudflare DNS + Tunnel)
- **Email:** Resend via post.keepmeiso.com (DKIM verified). Sender: support@post.keepmeiso.com
- **Hosting:** Ubuntu Mac Mini server (same as CRANIS2, separate Docker stack)
- **Cloudflare Tunnel:** Single tunnel with ingress rules for both CRANIS2 and keepmeiso.com
- **Super admin:** support@keepmeiso.com / KeepMeIso@2026

### Remote Development

Docker runs on a remote Ubuntu server accessed via SSH (`cranis2-vscode`). Project path on server: `/home/mcburnia/ISOAI`. Locally, files are at `/Users/andimcburnie/ISOAI`. Docker commands must be run via `ssh cranis2-vscode "cd /home/mcburnia/ISOAI && docker compose ..."`. SSH tunnels map container ports to localhost (5174, 3100, 5436). Cloudflare Tunnel serves keepmeiso.com → localhost:5174 (frontend) and api traffic via Vite proxy.

## Completed Work

- Full platform build: all 17+ modules
- Multi-tenant architecture with schema-per-tenant PostgreSQL
- 14 ISO standards with 640 controls seeded
- 41 training modules across all standards
- 20 harmonized requirements (HLS) linking 5 certifiable standards
- Multi-standard compliance UI
- Email invitation system with forced password reset (Resend)
- Activity logging across all modules
- Per-tenant standard selection and filtering
- Platform organisation management UI
- Two-tier role hierarchy (SUPER_ADMIN, ADMIN, AUDITOR, COMPLIANCE_USER)
- Complete rebrand from Gibbs Consulting to Keep Me ISO with enterprise colour palette
- Cloudflare Tunnel and Resend email delivery
- Compliance scheduling engine (11 obligation types, frequency config, complete/skip workflows)
- Training assessments (question bank, quiz UI, randomised questions/answers, pass/fail, retake)
- Ongoing competence checking (adaptive daily/weekly frequency, hints, auto-escalation)
- Competence dashboard for admins

## Known Issues

- Backend type check has ~10 pre-existing `string | string[]` Express query typing warnings (not regressions)
- Vite dev server HMR can cause page refreshes when files are synced to server during active use
- No automated tests (frontend or backend)
- No production hardening (rate limiting, CORS lockdown, HTTPS)
- No evidence upload UI for training/compliance
- No export/reporting functionality
- No notification system for due date alerts
- Logout button could be more prominent

## Current Status

Platform has core compliance tracking, per-tenant standard selection, organisation management, role-based access, compliance scheduling, and training assessments with ongoing competence verification. Three test tenants exist: "Default Organisation", "Bedrock Inc.", and "Gibbs Consulting".

Next priority: notification system (in-app + email alerts for due/overdue obligations and competence checks). See BACKLOG.md.
