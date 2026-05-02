# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

EnvDocOS Traffic V1 is built and shipped. The Next.js app lives at the repo root. Active work is tracked in `docs/backlog.md` and `docs/plans/`.

- `src/` — application code (Next.js 14 App Router + TypeScript).
- `test/` — Vitest API tests + setup helpers.
- `e2e/` — Playwright E2E flows.
- `envdocos_traffic_v1_package_full/` — original spec package. Each doc has an "Addenda" section pointing at the current behavior; treat code as the source of truth.
- `envdocos_v1_retry/` — early stub. Ignore.

## Product Constraints (do not violate)

EnvDocOS Traffic is a **report compiler**, not traffic engineering software. Per `envdocos_traffic_v1_package_full/docs/01_product_spec.md`:

- **Do not build:** traffic prediction, simulation, camera analytics, ML/forecasting, data collection.
- **Do build:** CSV ingest → metrics → template-interpolated report sections → editable UI → DOCX/PDF export.
- Output is a draft for a licensed engineer to review and stamp. Templates live in `envdocos_traffic_v1_package_full/docs/02_report_template.md`.

## Architecture

- **Routes (App Router):** auth surface under `src/app/api/auth/*`; project surface under `src/app/api/projects/[id]/*`; reports under `src/app/api/reports/[id]/*`. UI under `src/app/{,projects/,reports/,account/,signin/,signup/,…}`.
- **DB (`src/lib/db.ts`):** lazy `postgres` (Porsager) singleton. All repo methods are `async`. Tables: `users`, `verification_tokens`, `password_reset_tokens`, `email_change_tokens`, `projects`, `traffic_counts`, `reports`, `report_sections`, `project_shares`, `audit_log`. Repos exported per concern (`projectRepo`, `reportRepo`, `userRepo`, `tokenRepo`, `shareRepo`, `auditRepo`). Migrations live in `src/lib/migrations/*.sql`, applied by `src/lib/migrate.ts` (tracked via `schema_migrations` table) — invoked from `scripts/migrate.mjs` as a `prestart` hook before `next start`. Local dev: `docker compose up -d` (Postgres on :5434). Tests: per-process schema (`test_<pid>_<rand>`) created in `test/env.ts` `beforeAll`, dropped in `afterAll`, all calls scoped via `search_path`. Prod: Neon (see `docs/adr/0002-postgres-vendor.md`).
- **Auth (`src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`):** Auth.js v5 with Credentials + bcryptjs. Edge-safe config split out so middleware doesn't pull in `bcryptjs`/`postgres`. Test backdoor: `AUTH_TEST_USER_ID` env var honored only when `NODE_ENV=test`.
- **Access guards (`src/lib/session.ts`):** discriminated-union `Guard<T>`. `requireProjectAccess(id, "read"|"write")` returns 401/404/403 as appropriate; editors satisfy `write`, readers don't. Owner-only operations (delete, share management) check `guard.role !== "owner"` after a `read` guard.
- **Email (`src/lib/email.ts`):** Resend wrapper with an `EMAIL_SINK=memory` mode for tests/E2E. Tests assert against `getCapturedEmails()`; the test-only endpoint at `/api/test-only/emails` exposes the sink to Playwright.
- **Audit:** `auditRepo.log({projectId, userId, action, details})` is called inline from mutation routes. Owner-only `GET /api/projects/:id/audit` exposes the feed.

## Stack

Next.js 14 (App Router) + TypeScript + TailwindCSS, Postgres via `postgres` (Porsager), Auth.js v5 (`next-auth@beta`) + bcryptjs, PapaParse, `docx` + `pdfkit` for export, `@dnd-kit/sortable` for editor reorder, Resend for email. Vitest 4 with `test.projects` (node + jsdom). Playwright + chromium for E2E.

## CSV Schema

```
intersection,period,approach,inbound,outbound,total
```

`period` is `"AM" | "PM" | "MIDDAY" | "OTHER"`. Sample at `envdocos_traffic_v1_package_full/sample_data/sample_traffic_counts.csv`.

## Commands

```
npm run dev         # next dev
npm run build       # next build
npm run start       # next start
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm test            # vitest run (node + jsdom projects)
npm run test:coverage  # with v8 coverage; fails on threshold drop
npm run e2e         # playwright test (uses prod build via webServer)
npm run format      # prettier --write src
npm run format:check
npm run check       # lint + typecheck + test + format:check
```

Single test by name: `npx vitest run -t "describe substring"` or `npx vitest run path/to/file.test.ts`.

## Coverage Thresholds (enforced in CI)

- `src/lib/**` — 92 stmt / 78 br / 95 fn / **95 lines**
- `src/app/api/**` — 85 / 75 / 80 / **90 lines**
- `src/app/**` — 80 / 70 / 70 / **85 lines**

Excluded with documented reasons: `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, the `[...nextauth]` trampoline, `src/app/api/test-only/emails`, server-component pages (covered via E2E), error/layout/global-error.tsx, `email.ts` (real send is integration-only), `types.ts`.

## Conventions

- Routes return `NextResponse.json({error}, {status})` for 4xx/5xx, plain `NextResponse` for 200/201, and `new Response(null, {status: 204})` for deletes.
- Discriminated-union guards: read with `if (!guard.ok) return guard.error;` then access `guard.userId / guard.project / guard.report / guard.role`. Don't reintroduce `if ("error" in guard)`.
- Project test fixtures must include `userId` (string or null). The test setup seeds a user and assigns its id to `AUTH_TEST_USER_ID` per test.
- New mutation routes should call `auditRepo.log(...)` after the successful write.
