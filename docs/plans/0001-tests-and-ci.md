# Plan 0001 — Tests & CI scaffold

Backlog: **B-001** · Priority **P0** · Effort **M**

## Goal

Stand up a test suite and a green-by-default CI pipeline so future feature work (B-010, B-011, B-020…) has a safety net. Today there are zero tests and no CI.

## Why now

Every backlog item touches either CSV parsing, the metrics engine, or the report-section templates. All three are pure functions today and trivial to test — but every day without tests the regression surface grows. This plan is sequenced first because B-011 (regenerate-without-losing-edits) needs a "compare last machine output to current content" diff, and that logic is impossible to land safely without tests.

## Scope

In:
- Vitest as the test runner (faster than Jest, native ESM, no extra Babel config).
- Unit tests for `src/lib/csv.ts`, `src/lib/reportGenerator.ts`, `src/lib/docx.ts`.
- Route-handler tests for the 7 API routes — exercise the handlers directly with a fake `Request`, against a temp SQLite DB.
- A `src/lib/db.ts` shim that lets tests inject a path / in-memory DB without changing app behavior.
- GitHub Actions workflow: `lint`, `typecheck`, `test`, `build` on every push and PR.
- `npm run test` and `npm run test:watch` scripts.

Out (separate stories):
- E2E browser tests (Playwright) — defer to a later plan once UI stabilizes.
- Coverage thresholds — measure first, set thresholds in a follow-up.
- Visual regression / screenshot tests.

## Acceptance criteria

1. `npm run test` runs Vitest, passes locally, and exits non-zero on any failure.
2. ≥80% line coverage on `src/lib/*` (measured with `vitest --coverage`, not enforced as a gate yet).
3. Every API route has at least one happy-path test and one validation-error test.
4. GitHub Actions workflow runs on every PR; required checks: `typecheck`, `lint`, `test`, `build`.
5. CI run on a fresh checkout completes in <4 min on the free runner.
6. README quick-start is updated to mention `npm run test`.

## Implementation steps

### Step 1 — Add Vitest

- `npm i -D vitest @vitest/coverage-v8`
- Create `vitest.config.ts` with: `test.environment = 'node'`, `test.globals = true`, `test.include = ['src/**/*.test.ts']`, `test.setupFiles = ['./test/setup.ts']`.
- Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.

**Verify:** `npm test` exits 0 with `No test files found`.

### Step 2 — Make the DB injectable

Currently `src/lib/db.ts` hard-codes `process.cwd() + "/data/envdocos.db"`. Add an `ENVDOCOS_DB_PATH` env-var override so tests can point at a temp dir or `:memory:`.

- Edit `src/lib/db.ts`: in the lazy `db()` helper, read `process.env.ENVDOCOS_DB_PATH` first, fall back to current behavior.
- Add `test/setup.ts` that sets `ENVDOCOS_DB_PATH` to `path.join(os.tmpdir(), 'envdocos-test-' + process.pid + '.db')` and removes it in a global `afterAll`.
- Add a small helper `test/db.ts` that exposes `resetDb()` — closes the cached connection and deletes the file — to call between tests.

**Verify:** Run a 1-line dummy test that imports `projectRepo` and inserts a project, confirm the file lands in tmpdir and is cleaned up.

### Step 3 — Unit tests for `lib/csv.ts`

Cases:
- Happy path: 3 rows, all required columns, mixed AM/PM → returns `{ ok: true, rows.length === 3 }`.
- Missing column → `{ ok: false }` and the error names the missing column.
- Invalid `period` → error mentions the row number (the user-facing row, i.e. 2 = first data row) and the bad value.
- Non-numeric `inbound`/`outbound`/`total` → error names the row.
- Empty `intersection` → error names the row.
- Headers with trailing whitespace are trimmed and accepted.
- Lowercase `am` / `pm` are normalized to `AM` / `PM`.

**Verify:** `npm test -- csv` passes; coverage ≥90% on `csv.ts`.

### Step 4 — Unit tests for `lib/reportGenerator.ts`

Cases:
- `calculateMetrics([])` returns zeros and empty `intersections`.
- `calculateMetrics` correctly sums per-intersection totals across periods (use the sample CSV rows).
- `generateReportSections` returns 8 sections in order 1-8 with `status: 'draft'`.
- The `existing-conditions` section interpolates `highestAmIntersection` and `highestPmIntersection` correctly.
- The `study-area` section says `"no intersections imported"` when rows are empty.
- The `executive-summary` section interpolates `project.projectType` and `project.location`.

**Verify:** Snapshot the 8 generated sections for a fixture project and lock the strings — this catches accidental template changes.

### Step 5 — Unit tests for `lib/docx.ts`

Cases:
- `buildReportDocx(project, report)` returns a non-empty Buffer.
- The buffer is a valid ZIP (DOCX is a ZIP) — assert `buf.slice(0,2)` is `0x504b` (`PK`).
- Use `unzip` (or just `Bun.file`/`adm-zip` dev dep — pick `jszip`, already pulled in by `docx`) to extract `word/document.xml` and assert each section title appears in the XML.

**Verify:** `npm test -- docx` passes.

### Step 6 — Route-handler tests

Build a small helper `test/route.ts`:

```ts
export function makeReq(method: string, body?: unknown, headers: Record<string,string> = {}) {
  return new Request("http://test.local", {
    method,
    headers: body && typeof body === "object" ? { "content-type": "application/json", ...headers } : headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}
```

For each route, write `route.test.ts` next to it (or in `test/api/`). Cases per route:

| Route | Happy path | Failure path |
|---|---|---|
| `POST /api/projects` | Valid body → 201, returns project with id | Missing `name` → 400 |
| `GET /api/projects/:id` | Existing project → 200 | Unknown id → 404 |
| `POST /api/projects/:id/traffic-data` | Valid CSV → 200 with `rowsImported` | Missing column → 400 |
| `POST /api/projects/:id/generate-report` | With rows → 200, 8 sections | No rows → 400 |
| `GET /api/reports/:id` | Existing → 200 with sections | Unknown → 404 |
| `PATCH /api/reports/:id/sections/:sectionId` | Valid patch → 200 | Bad status → 400 |
| `POST /api/reports/:id/export-docx` | → 200 with `application/vnd.openxml…` content-type and PK-prefixed body | Unknown report → 404 |

**Verify:** All 14 cases pass; total suite runs in <5 s locally.

### Step 7 — GitHub Actions workflow

Create `.github/workflows/ci.yml`:

- Trigger: `push` to `main` and `pull_request`.
- Single job, `ubuntu-latest`, Node 20.
- Steps: checkout, setup-node with `cache: 'npm'`, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Job timeout 10 min.

**Verify:** Push a branch and open a PR; all four steps go green. Check CI duration is <4 min.

### Step 8 — Branch protection

Once green, ask the user (don't do this autonomously) to enable branch protection on `main` requiring `lint`, `typecheck`, `test`, `build` checks.

## Test plan

The output of this plan _is_ the test plan. Self-validating:

- [ ] `npm test` exits 0 with ≥30 passing tests
- [ ] `npm run test:coverage` reports ≥80% on `src/lib/*`
- [ ] CI workflow runs green on a fresh PR
- [ ] CI run completes in <4 min
- [ ] README mentions `npm run test`

## Risks / open questions

- **Better-sqlite3 native build on CI runners.** Should "just work" on `ubuntu-latest` Node 20 — but if it flakes, fall back to caching `~/.cache/node-gyp` or pinning a prebuilt binary version. Watch for this in the first CI run.
- **Test DB contention.** The lazy `db()` helper caches one connection per process. Vitest runs tests in worker threads by default — confirm `pool: 'threads'` doesn't cause cross-test connection leaks. If it does, use `pool: 'forks'` and accept the slower startup.
- **Drift from production schema.** Tests use the same `SCHEMA_SQL` constant the app uses, so the schema can't diverge. No risk here.

## File touches

- New: `vitest.config.ts`, `test/setup.ts`, `test/db.ts`, `test/route.ts`
- New: `src/lib/csv.test.ts`, `src/lib/reportGenerator.test.ts`, `src/lib/docx.test.ts`
- New: `src/app/api/**/route.test.ts` (7 files)
- New: `.github/workflows/ci.yml`
- Edit: `src/lib/db.ts` (env-var override)
- Edit: `package.json` (scripts + devDeps)
- Edit: `README.md` (test section)
