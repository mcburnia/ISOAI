# RESTART.md — Gibbs IMS

Last updated: 2026-03-22

## Architecture

### Overview

Three-service Docker Compose stack: PostgreSQL 16, Node.js/Express backend, Vite/React frontend.

### Multi-Tenancy

- **Schema-per-tenant isolation** — each tenant gets its own PostgreSQL schema cloned from `tenant_template`
- **AsyncLocalStorage-based routing** — transparent Prisma proxy routes queries to the correct tenant schema based on request context
- **Platform schema** — stores tenant metadata, platform-level admin users
- Tenant creation clones `tenant_template` schema (includes all tables, seed data for 640 controls and 41 training modules)

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
- Admin — user management with email invitation, forced password reset
- Settings — user account settings

### Brand

Gibbs Consulting. Colours: dark green (#00300F), primary green (#0A5C26), bright green (#50AD33). Sidebar branding: "Integrated Management System".

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

## Known Issues

- No automated tests (frontend or backend)
- No production hardening (rate limiting, CORS lockdown, HTTPS)
- No evidence upload UI for training/compliance
- No export/reporting functionality
- No notification system for review due dates
- No RBAC beyond admin/user (no per-module permissions)

## Current Status

Platform is feature-complete for core compliance tracking. Deployed on Ubuntu server via Docker Compose.

Next priority: per-tenant standard selection and filtering. The platform schema already supports `TenantStandard` (junction table linking tenants to their chosen ISO standards), but the tenant-side code currently shows all 14 standards to every organisation. This must be enforced before building the compliance scheduling engine and notification system. See BACKLOG.md for full sequencing.
