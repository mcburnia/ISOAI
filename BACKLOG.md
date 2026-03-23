# Keep Me ISO — Active Backlog

Updated: 2026-03-22

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
- Slug validation: auto-strips invalid characters, frontend validation before submission, detailed zod error display

## Next Up

### 1. Compliance scheduling engine
Every ISO management system standard requires recurring obligations at planned intervals. The platform currently records when things happened but has no concept of when they should happen next.

Work required:
- `ScheduledObligation` model covering all recurring compliance processes
- Frequency configuration (annual, semi-annual, quarterly, monthly, custom)
- Responsible person assignment (user or governance role)
- Due date calculation from frequency and last completion
- Default obligations seeded per activated standard
- Obligation management UI for org admins

Obligation types mapped from the standards:

| Process | Standard clauses | Default frequency |
|---------|-----------------|-------------------|
| Internal audit | 9.2 (all certifiable) | Annual |
| Management review | 9.3 (all certifiable) | Annual |
| Risk assessment review | 6.1.2, 8.2 | Semi-annual |
| AI system review | 42001 8.4, 42005 | Annual per system |
| AI impact assessment | 42001 8.4, 42005 | Annual per system |
| Human oversight review | 42001 clause 8 | Quarterly per system |
| Monitoring review | 9.1 | Quarterly per system |
| Document/policy review | 5.2 | Per document cycle |
| Training renewal | 7.2, 7.3 | Annual per module |
| Corrective action follow-up | 10.2 | Per-finding deadline |
| Competence re-evaluation | 7.2 | Annual per role |

### 2. Training assessments and ongoing competence testing
Proves understanding, not just attendance. ISO 7.2 (Competence) requires evidence that personnel are actually competent, not merely that they received training material.

Work required:
- **Question bank per training module** — multiple-choice questions authored by admins, tagged to the module
- **Post-training assessment** — on completing a module, user must pass a test (configurable pass mark, default 80%)
- **Pass/fail outcome** — pass records the completion with score; fail requires the user to retake the training and retest
- **Configurable pass threshold** — org admin can set the minimum pass percentage per module or globally
- **Random ongoing competence checks** — the scheduler sends a random question from completed training modules to each user periodically (default: one question per week)
- **Competence check tracking** — correct/incorrect answers are logged as ongoing evidence of understanding
- **Competence dashboard** — admin view showing pass rates, retest frequency, ongoing check scores per user
- **Integration with scheduling engine** — "competence re-evaluation" obligation type triggers from failed ongoing checks or time-based renewal

### 3. Notification system
Depends on the scheduling engine. Ensures nothing gets forgotten.

Work required:
- `Notification` model (in-app notifications per user)
- `node-cron` daily job inside the backend to check obligations against due dates
- Notification creation for items due within configurable window (e.g. 7 days) and overdue items
- Email alerts via SMTP for due and overdue items
- Notification bell in the header with unread count
- Notification panel listing upcoming, due, and overdue obligations

### 4. AI Compliance Pilot
Context-aware assistant for gap analysis, control explanations, and policy/evidence generation. Deferred until the scheduling and notification foundations are in place.

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
