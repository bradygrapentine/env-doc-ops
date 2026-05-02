# Plan 0007 — Postgres migration + Vercel deploy + Upstash rate limiter + backlog refresh

Date: 2026-05-01
Status: Proposed

## Goal

Get the app deployed on Vercel with a real durable database, fix the rate limiter for multi-process before any production traffic, and refresh the backlog with the next round of tech debt.

Three phases, sequenced. Each phase ships independently; later phases depend on earlier ones.

---

## Phase A — SQLite → Postgres migration

The largest piece. Vercel's filesystem is ephemeral, so `better-sqlite3` cannot ship to prod as-is.

### Decisions (locked)

- **DB**: Postgres (vendor TBD — Neon, Supabase, or Vercel Postgres; pick during A.1).
- **Driver**: `postgres` (Porsager) — raw SQL, async, no ORM. Closest to the current `better-sqlite3` repo style.
- **Migrations**: hand-rolled `.sql` files under `src/lib/migrations/` numbered sequentially, applied at startup with a `schema_migrations` table tracking applied filenames. No external migration tool.

### A.1 — Vendor pick + ADR (S)

- Write `docs/adr/0002-postgres-vendor.md` comparing Neon vs Supabase vs Vercel Postgres on: free-tier limits, connection pooling story (PgBouncer / serverless), branching for preview envs, region locality with Vercel.
- Recommendation up front; rationale below.
- Output: ADR + chosen vendor + connection string format documented.

### A.2 — Driver swap behind the existing repo API (M)

- Add `postgres` dep, drop `better-sqlite3` dep + `@types/better-sqlite3`.
- `src/lib/db.ts`: replace `Database` singleton with `postgres()` client. Keep the same exported repo objects (`projectRepo`, `reportRepo`, `userRepo`, `tokenRepo`, `shareRepo`, `auditRepo`) — every call site stays identical.
- Convert each repo method's SQL: `?` placeholders → `${}` tagged template, `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGSERIAL`, `TEXT` stays, `INTEGER` → `INTEGER` / `BIGINT` as appropriate, JSON columns → `JSONB`, `datetime('now')` → `now()`, `CHECK` constraints stay.
- Async: every repo method becomes `async`. Every call site (~40 routes + tests) needs `await`. This is the bulk of the diff.
- Drop the test-only "memory mode" backdoor if it only existed for sqlite — replace with a per-test schema or transaction rollback (see A.4).

### A.3 — Migrations runner (S)

- `src/lib/migrations/001_initial.sql` through `00N_*.sql` — translate the current idempotent ALTER blocks in `db.ts` into ordered files. The `project_shares.role` widen-to-editor migration becomes its own file.
- `src/lib/migrate.ts`: reads `schema_migrations` table, runs unapplied files in order, in a transaction per file.
- Called once at app boot (App Router instrumentation hook) and once at test setup.

### A.4 — Test rewrite (M)

- Vitest currently uses an in-memory sqlite per test. Replace with: spin up a `pg-mem` instance OR require a real Postgres at `TEST_DATABASE_URL` and run each test inside a savepoint that rolls back.
- Recommend `pg-mem` for unit speed if it covers our SQL surface; fall back to real Postgres in CI if `pg-mem` chokes on `JSONB` ops or `now()`.
- E2E (Playwright) needs a real Postgres — spin one in CI via service container.
- Update `test/setup.ts` to migrate + seed against the new client.

### A.5 — CI Postgres service (S)

- `.github/workflows/ci.yml`: add a `services: postgres:16` block, set `TEST_DATABASE_URL`. Run migrations before test step.

### A.6 — Verify (gate before Phase B)

- `npm run check` green.
- `npm run e2e` green against real Postgres.
- Manual smoke locally pointing at a dev Postgres (Docker compose or vendor's free tier).

**Files touched**: `src/lib/db.ts`, `src/lib/migrate.ts` (new), `src/lib/migrations/*.sql` (new), every API route (`await` insertion), every test file, `package.json`, `.github/workflows/*`, `CLAUDE.md` (DB section update).

**Out of scope**: ORM introduction, schema redesign, RLS, read replicas.

---

## Phase B — Vercel deploy + Upstash rate limiter

### B.1 — Vercel link + env (S)

- `vercel link` against `bradygrapentine/env-doc-ops` (user runs interactively).
- Project settings: framework Next.js, install cmd `npm ci`, build cmd `npm run build`.
- Env vars (Production + Preview): `AUTH_SECRET`, `AUTH_URL`, `DATABASE_URL` (from Phase A vendor), `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SINK=resend`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_DISABLED` unset.
- Preview deploys on PR enabled.
- First deploy: verify `/signin`, signup happy path, audit log writes.

### B.2 — Upstash rate limiter (B-053 ship) (S)

- Create Upstash Redis DB (user does this in console or via `npx @upstash/cli`).
- Write `docs/adr/0001-rate-limit-shared-store.md`: chose Upstash (vendor-neutral, REST-based, free tier covers expected volume, works from Vercel edge + Node).
- Add `@upstash/ratelimit` + `@upstash/redis` deps.
- Replace `src/lib/rate-limit.ts` internals: keep `consume(key, action)` and `resetSucceeded(key, action)` signatures byte-for-byte. Implementation switches to Upstash sliding-window. `rate-limit-policy.ts` is unchanged.
- Local dev fallback: if `UPSTASH_REDIS_REST_URL` unset, use the existing in-memory Map (current behavior). Document this in `CLAUDE.md`.
- Tests: existing rate-limit tests stay using the in-memory fallback. Add 2 integration tests gated on `UPSTASH_REDIS_REST_URL` being set in CI.
- Mark B-053 shipped in backlog.

### B.3 — Verify (gate before Phase C)

- Deploy succeeds, health check from preview URL.
- Rate limit triggers correctly against Upstash (manual: 11 forgot-password requests from one IP → 11th returns 429).

**Files touched**: `src/lib/rate-limit.ts`, `package.json`, `docs/adr/0001-*.md`, `vercel.json` (if needed), `CLAUDE.md` (env vars + deploy section), `docs/backlog.md`.

---

## Phase C — Backlog refresh (plan 0008 follow-on)

After A + B are merged, refresh `docs/backlog.md` with new Ready stories drawn from §2 tech debt + anything surfaced during A/B:

- **B-060 — Structured logger**. Replace `console.error` with `pino` (or similar). JSON output in prod, pretty in dev. Required for any meaningful Vercel log triage.
- **B-061 — Coverage exclusion retirement via integration tests**. Stand up an integration-test project that runs against real Postgres + real Auth.js + real middleware, then drop `auth.ts` / `auth.config.ts` / `middleware.ts` / `email.ts` from the coverage exclusion list.
- **B-062 — CSRF audit on manual fetch routes**. Audit every POST/PATCH/DELETE under `/api/*` that isn't behind Auth.js's built-in CSRF. Add explicit Origin / Referer check at the middleware layer if any are exposed.
- **B-063 — Audit log retention / prune**. Once a cron host exists (Vercel Cron after Phase B), add a daily job that deletes `audit_log` rows older than N days (default 365).
- **B-064 — Sentry / error reporting**. Wire Sentry to capture unhandled errors in prod. Optional but cheap once Vercel is live.

This phase is scope-only — pick a subset for plan 0008 once A+B land.

---

## Sequencing

```
A.1 → A.2 → A.3 → A.4 → A.5 → A.6  (serial, single track)
                                    ↓
                               B.1 → B.2 → B.3
                                              ↓
                                         Phase C planning
```

Phase A is too entangled (every file touched, all tests rewritten) to parallelize meaningfully. Phase B is two small steps. Don't dispatch subagents for any of this.

## Risks

- **`pg-mem` SQL gap**: if it can't run our `JSONB` ops or recursive CTEs, fall back to real Postgres in tests — slower but works. Decide in A.4.
- **Auth.js v5 + Postgres adapter**: we use Credentials provider with our own user table, not the official adapter. No change needed.
- **Vercel cold starts + connection pooling**: Neon / Supabase have HTTP/serverless drivers; Vercel Postgres has built-in pooling. Picking one in A.1 must consider this.
- **Free-tier limits**: Neon free tier is 0.5 GB; Supabase 500 MB; Vercel Postgres 256 MB. All fine for dev, none for real prod traffic. Out of scope for this plan but flag in the ADR.

## Done when

- App deployed on Vercel with Postgres backend, rate limiter using Upstash, all CI green, B-053 marked shipped in backlog, plan 0008 drafted with refined Phase C stories.
