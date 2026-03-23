# Keep Me ISO — Active Backlog

Updated: 2026-03-23

## Recently Completed

### Per-tenant standard selection and filtering ✓
- Org admin UI to activate/deactivate standards (Admin > Standards)
- Backend active standards service with 5-minute in-memory cache (`activeStandards.ts`)
- Compliance views, training modules, and dashboard metrics filter to activated standards only
- Settings page shows organisation info and active standards badges
- "Learn more" expandable descriptions for all 14 standards with layman-friendly summaries

### Platform organisation management ✓
- Admin > Organisations page for creating, viewing, and managing tenants
- Create form with auto-generated slug, optional admin user provisioning
- Expandable detail view showing schema, plan, active standards, status controls
- Suspend, reactivate, and cancel workflows

### Two-tier role hierarchy ✓
- SUPER_ADMIN (platform admin, Gibbs/KMI staff), ADMIN (org admin), AUDITOR (read-only), COMPLIANCE_USER (standard working role)
- Deployment-mode-aware middleware (SaaS vs self-hosted)
- requireComplianceUser middleware on all write routes blocks auditors
- Frontend role helpers (isAdmin, isSuperAdmin, isAuditor, canWrite)
- User management with role dropdown, SUPER_ADMIN protection
- Sidebar split into Admin and Platform sections

### Complete rebrand to Keep Me ISO ✓
- All Gibbs Consulting references removed from codebase
- KEEPMEISO.COM text logo with coral (#F97316) accent on navy (#0F3D7C) palette
- Enterprise trust colour palette: navy primary, coral accent, clean grey background, slate text
- Tailwind tokens renamed gibbs-* → kmi-*
- Policy documents and training modules use "the organisation" (tenant-agnostic)
- Resend email via post.keepmeiso.com, Cloudflare Tunnel to keepmeiso.com

### Compliance scheduling engine ✓
- ScheduledObligation and ObligationInstance models with 11 obligation types
- Frequency configuration (monthly, quarterly, semi-annual, annual, custom days)
- Obligation management UI for admins with complete/skip workflows
- Dashboard summary cards (upcoming, overdue, completed this month)

### Training assessments and ongoing competence testing ✓
- AssessmentQuestion, AssessmentAttempt, CompetenceCheck models
- Question bank per training module with admin CRUD (QuestionBank.tsx)
- Post-training assessment with configurable pass threshold (default 80%)
- Questions and answer options randomised per attempt; correct answer never in same position consecutively
- Pass creates TrainingRecord with score evidence; fail deletes record and forces retake
- Retake Assessment button on completed modules
- Training progress and quiz answers persisted in localStorage (survives page refresh)
- 8 seed questions for AI Governance Awareness module
- Ongoing competence checks: weekly random questions from completed modules
- Adaptive frequency: correct=1.0, correct+hint=0.5, incorrect=0.0; above threshold=weekly, below=daily
- "Show Hint" refresher on competence checks with tracked usage
- 3 consecutive failures auto-create TRAINING_RENEWAL obligation
- Competence Dashboard (Admin > Competence): per-user scores, hint usage, frequency, flagged users
- Dashboard banner prompting users when competence checks are due

## Next Up

### 1. Notification system
Ensures nothing gets forgotten. Delivers competence check reminders, obligation due alerts, and overdue warnings.

Work required:
- `Notification` model (in-app notifications per user)
- `node-cron` daily job inside the backend to check obligations against due dates
- Notification creation for items due within configurable window (e.g. 7 days) and overdue items
- Email alerts via Resend for due and overdue items
- Notification bell in the header with unread count
- Notification panel listing upcoming, due, and overdue obligations

### 2. AI Compliance Pilot
Context-aware assistant for gap analysis, control explanations, and policy/evidence generation. Deferred until the notification foundation is in place.

## Planned

- Evidence upload UI (training records, compliance evidence, file attachments)
- Export and reporting (PDF compliance reports, CSV data export)
- Production hardening (rate limiting, CORS lockdown, HTTPS, secure headers)
- Statement of Applicability generator
- Risk heat map visualisation
- White-label branding (per-tenant logo, colours, product name, email sender name; design proper KMI logos; update seed documents to use tenant name dynamically)
- Automated tests (backend API, frontend components)
- Make logout button more prominent

## Parked

- RBAC enhancements (per-module permissions)
- Asset register
- Self-service organisation registration (currently admin-only by design)
