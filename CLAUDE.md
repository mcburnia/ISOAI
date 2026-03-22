# CLAUDE.md — Gibbs IMS

Read this file at the start of every session.

## What is Gibbs IMS?

A multi-tenant SaaS platform for integrated management system compliance. Organisations use it to track compliance across 14 ISO standards (42001, 27001, 9001, 27701, and 10 more), manage AI system inventories, risk registers, incidents, training, audits, and governance roles. Schema-per-tenant PostgreSQL isolation. Dockerised for deployment.

## Operating Protocol

1. Propose first, then implement. Wait for approval before making changes.
2. One commit per completed task with a detailed message (subject line + body explaining why).
3. Developer performs git push manually.
4. Run the build/typecheck after each task and report the outcome.
5. Use British English throughout.

## Environment

- **Runtime:** Node.js 20 (Docker containers)
- **Database:** PostgreSQL 16 on port 5436 (mapped from container 5432)
- **Backend:** Express + TypeScript + Prisma ORM, port 3100
- **Frontend:** Vite + React + TypeScript + Tailwind CSS, port 5174 (mapped from container 5173)
- **Deployment:** `docker compose up --build` from project root

### Key Commands

```bash
# Start everything
docker compose up --build

# Backend shell (for Prisma commands)
docker exec -it isoai-backend sh

# Run Prisma migration
npx prisma migrate dev

# Seed database
npx tsx prisma/seed.ts

# Frontend type check
cd frontend && npx tsc --noEmit

# Backend type check
cd backend && npx tsc --noEmit
```

### Port Map

| Service    | Container Port | Host Port |
|------------|---------------|-----------|
| PostgreSQL | 5432          | 5436      |
| Backend    | 3100          | 3100      |
| Frontend   | 5173          | 5174      |

## Project Rules

- This is a **Gibbs Consulting** project. No references to other clients, projects, or organisations in the codebase.
- Never modify migration files directly — create new migrations.
- Never commit `.env` files or credentials.
- The `.claude/.env` file contains local paths and must not be committed.
- Follow the file size guidelines: flag at 500+ lines, propose decomposition at 800+.
- No over-engineering: no error handling for impossible scenarios, no abstractions for one-time operations, no design for hypothetical futures.

## Project Context

See `RESTART.md` for architecture and current status.
See `BACKLOG.md` for active work items.
