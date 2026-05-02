# ADR 0002 — Postgres vendor: Neon

Date: 2026-05-01
Status: Accepted

## Context

Phase A of plan 0007 migrates the app off `better-sqlite3` onto Postgres so it can deploy to Vercel (ephemeral filesystem rules out file-backed SQLite). We need to pick a managed Postgres before writing the driver swap.

Constraints:

- Must work from Vercel's serverless Node runtime without exhausting connection pools on cold starts.
- Free tier needs to cover dev + staging + small prod (low single-digit GB, low QPS).
- Want per-PR preview environments to point at isolated DB state without manual setup.
- Keep vendor lock-in low — prefer plain Postgres over a vendor-extended dialect.

## Options considered

### Neon

- Serverless Postgres, separates compute from storage. Compute scales to zero.
- **Branching**: per-branch DBs created in seconds via API or CLI. Designed exactly for preview-deploy workflows — the Vercel integration auto-creates a branch DB per PR.
- HTTP driver (`@neondatabase/serverless`) for edge runtimes; standard `postgres://` for Node.
- Free tier: 0.5 GB storage, 191.9 compute hours/month, branching included.
- Plain Postgres 16. No proprietary extensions on the hot path.

### Supabase

- Postgres + auth + storage + realtime bundled. We use Auth.js, not Supabase Auth — most of the bundle is dead weight here.
- No native branching for preview envs; would need to script schema clones.
- Free tier: 500 MB, pauses after 1 week of inactivity.
- Connection pooling via PgBouncer (transaction mode).

### Vercel Postgres

- Neon under the hood (Vercel resold it until late 2024; now pushes you to Neon directly via the marketplace integration). Picking Vercel Postgres today routes you through the same Neon backend with a Vercel-flavored dashboard and a hard tie to the Vercel project.
- One-click setup from the Vercel project dashboard, env vars auto-injected.
- Tied to a single Vercel project — moving the DB out later is friction.
- Free tier: 256 MB, 60 compute hours.

## Decision

**Neon**, accessed directly (not through the Vercel-Postgres reseller wrapper).

Rationale:

- **Branching is the killer feature** for our preview-deploy story. PR opens → new branch DB → preview deploy points at it → PR closes → branch deleted. Supabase requires building this ourselves.
- **Same backend as Vercel Postgres** with more headroom on the free tier and no Vercel-project lock-in. If we ever leave Vercel, the DB stays put.
- **Plain Postgres 16** keeps the SQL we write portable. No Supabase-specific helpers leak into the codebase.
- Supabase's bundled features (auth, storage) duplicate what we already have or don't need.

## Consequences

- Dev: each developer gets a Neon branch off `main`. Local `.env.local` points at it.
- CI: tests run against a `postgres:16` service container, not Neon — keeps CI deterministic and free.
- Preview deploys: Vercel ↔ Neon integration auto-creates a branch per PR. Configured in Phase B.1.
- Prod: single `main` branch. Connection string lives in Vercel env vars.
- Driver: `postgres` (Porsager) for Node; the Neon HTTP driver is available if we ever move pieces to edge runtime.
- Migrations: run on app boot via the Phase A.3 runner. Neon's branching means each preview gets a fresh schema run automatically.

## Followups

- Pick a paid tier before public launch — free tier 0.5 GB will not survive real audit-log growth past a few months.
- B-063 (audit log retention/prune) becomes load-bearing once we're paying per GB.
- If serverless connection storms become a problem, switch to Neon's pooled connection string (`-pooler` host).
