# RESTART.md — Keep Me ISO

Last updated: 2026-03-22

## Architecture

### Overview

Three-service Docker Compose stack: PostgreSQL 16, Node.js/Express backend, Vite/React frontend.

### Multi-Tenancy

- **Schema-per-tenant isolation** — each tenant gets its own PostgreSQL schema cloned from `tenant_template`
- **AsyncLocalStorage-based routing** — transparent Prisma proxy routes queries to the correct tenant schema based on request context
- **Platform schema** — stores tenant metadata (`platform."Tenant"`), standards catalogue (`platform."Standard"`), and tenant-standard activation (`platform."TenantStandard"`)
- Tenant creation clones `tenant_template` schema (includes all tables, seed data for 640 controls and 41 training modules)
- **Per-tenant standard selection** — org admins choose which ISO certifications to pursue; compliance, training, and dashboard views filter to show only activated standards

### Access Tiers

- **Platform super-admin** — manages tenants, onboards organisations (currently uses ADMIN role; SUPER_ADMIN role reserved for future)
- **Organisation admin** (ADMIN role) — manages users, activates/deactivates standards, manages compliance within their tenant
- **Standard user** (USER role) — day-to-day compliance work within their tenant

### Database

PostgreSQL 16 with Prisma ORM. Key models:

- **User** — JWT auth with bcrypt, forced password reset on first login
- **AISystem** — inventory with risk classification, deployment status, review dates
- **Risk** — register with category, likelihood, impact, mitigation
- **LifecycleEntry** — 7-stage pipeline per system
- **Incident** — severity, status workflow, corrective actions
- **OversightRecord** — human oversight reviews per system
- **MonitoringRecord** — performance monitoring per system
- **TrainingModule** — 41 modules across 14 standards with content, quiz, completion tracking
- **TrainingRecord** — per-user completion records
- **Audit / AuditFinding** — internal audit with findings and corrective actions
- **ManagementReview** — review records
- **GovernanceRole** — role assignments (5 governance roles, optionally per-system)
- **ControlMapping** — 640 controls across 14 standards with status tracking
- **HarmonizedRequirement** — 20 HLS requirements linking 5 certifiable standards (clauses 4–10)
- **PolicyDocument** — 13 seeded governance documents
- **ActivityLog** — audit trail for all CRUD operations

### Standards Covered (14)

ISO 42001, 27001, 9001, 27701, 27017, 27018, 27002, 22301, 20000-1, 31000, 23894, 25024, 5338, 42005

### Frontend

React + TypeScript + Tailwind CSS. Key pages:

- Dashboard — KPI cards, per-standard compliance breakdown, risk breakdown, training completion, recent activity
- AI Systems — inventory CRUD with detail views
- Risk Register — CRUD with system filtering
- Lifecycle — stage pipeline view
- Incidents — CRUD with severity/status workflow
- Human Oversight — review records
- Monitoring — performance records
- Policy Documents — 13 governance documents with markdown rendering
- Roles & Responsibilities — governance role assignments
- Training — 41 modules grouped by standard, completion tracking, quiz system
- Audits & Reviews — audit CRUD, findings, management reviews
- Control Mapping — 14-standard selector, status filters, collapsible clause sections, inline editing, HLS badges
- Activity Log — full audit trail
- Settings — user profile, organisation info, active standards summary
- Admin > User Management — user CRUD with email invitation, forced password reset
- Admin > Standards — per-tenant standard activation with "Learn more" expandable descriptions for all 14 standards
- Admin > Organisations — platform-level tenant management (create, suspend, reactivate, cancel)

### Brand

Product brand: Keep Me ISO (KMI). Placeholder logos in use until proper KMI branding is designed. Colours: dark green (#00300F), primary green (#0A5C26), bright green (#50AD33). Tailwind token prefix: `kmi-`.

### Remote Development

Docker runs on a remote Ubuntu server accessed via SSH (`cranis2-vscode`). Project path on server: `/home/mcburnia/ISOAI`. Locally, files are at `/Users/andimcburnie/ISOAI`. Docker commands must be run via `ssh cranis2-vscode "cd /home/mcburnia/ISOAI && docker compose ..."`. SSH tunnels map container ports to localhost (5174, 3100, 5436).

## Completed Work

- Full platform build: all 17 modules (auth, systems, risks, lifecycle, incidents, oversight, monitoring, training, audits, roles, compliance, documents, activity-log, users, platform, settings, admin)
- Multi-tenant architecture with schema-per-tenant PostgreSQL
- 14 ISO standards with 640 controls seeded
- 41 training modules across all standards
- 20 harmonized requirements (HLS) linking 5 certifiable standards
- Multi-standard compliance UI (standard selector, filters, per-standard dashboard metrics)
- Email invitation system with forced password reset
- Activity logging across all modules
- Git repository initialised and pushed to GitHub (mcburnia/ISOAI)
- Per-tenant standard selection and filtering (backend service with 5-minute cache, org admin UI, filtered compliance/training/dashboard views)
- "Learn more" expandable descriptions for all 14 ISO standards (layman-friendly summaries)
- Platform organisation management UI (Admin > Organisations): create tenants with optional admin user, view/expand tenant details, suspend/reactivate/cancel organisations
- Settings page shows organisation name, identifier, and active standards badges
- Slug validation fix: auto-strips invalid characters, frontend validation, detailed zod error display

## Known Issues

- Backend type check has ~10 pre-existing `string | string[]` Express query typing warnings (not regressions, all in systems/training/users controllers)
- No automated tests (frontend or backend)
- No production hardening (rate limiting, CORS lockdown, HTTPS)
- No evidence upload UI for training/compliance
- No export/reporting functionality
- No notification system for review due dates
- No RBAC beyond admin/user (no per-module permissions)
- Logout button could be more prominent (currently small icon at bottom of sidebar)

## Current Status

Platform is feature-complete for core compliance tracking with per-tenant standard selection. Organisation management is operational. Two test tenants exist: "Default Organisation" (Professional) and "Bedrock Inc." (Starter).

Next priority: compliance scheduling engine and notification system. See BACKLOG.md for full sequencing.
