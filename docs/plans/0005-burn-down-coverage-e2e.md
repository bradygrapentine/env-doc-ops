# Plan 0005 — Burn down remaining backlog + raise coverage to 95% + add E2E

Backlog: **B-014, B-031, B-041, B-042b** + cross-cutting test work.

## Why this is one plan

These pieces are sequenced for a reason: writing component tests for code we're about to change is wasted work, and E2E tests need a stable feature surface. The order is **features first → coverage sweep → E2E**.

## Open decisions (need user approval before execution)

1. **Email service for B-042b.** Default: **Resend** — generous free tier, simple SDK, no DNS until you go above 100/day. Alternatives: SendGrid, AWS SES, Mailgun, or `nodemailer` against a local Mailtrap inbox (dev-only). The plan below assumes Resend.
2. **E2E framework.** Default: **Playwright** — first-party browser support, Auth.js + Next.js have first-class examples, single-binary install, parallel execution. Alternative: Cypress.
3. **Coverage scope.** Default: **95% statements, 90% branches, 90% functions on `src/lib/*` and `src/app/api/**` only**. Server components and client React components targeted at 80% (lower because their tests need testing-library + jsdom and are higher-effort). Coverage gate is enforced in CI as a hard fail.
4. **Sharing model for B-041 (read vs read+write).** Default: **read-only invites only for V1**. Read+write is its own follow-up because it forks the conflict-resolution story.

If any default is wrong, redirect before the next batch.

---

## Phase 1 — Feature burn-down

Four items, sequenced as two parallel waves.

### Wave 1 (in parallel — disjoint file sets)

#### Track A — B-014 — Section reorder + add/remove custom sections — P2 · M

**Goal.** A signed-in user, on the report editor, can drag sections to reorder them, add a new "Custom" section, and remove user-added custom sections (cannot remove the 8 standard sections).

**Schema.** None. `report_sections` already has `order INTEGER`. Add a `kind TEXT NOT NULL DEFAULT 'standard'` column. Standard sections have `kind='standard'`, user-added have `kind='custom'`. Idempotent ALTER pattern.

**API.**
- `PATCH /api/reports/:id/sections/order` — body `{ orderedIds: string[] }`. Validates that the set equals the report's existing section ids exactly (no additions, no removals, no duplicates). Reassigns `order` 1..N in the given order.
- `POST /api/reports/:id/sections` — body `{ title: string, content?: string }`. Inserts a new `kind='custom'` section at the end. Returns the new section.
- `DELETE /api/reports/:id/sections/:sectionId` — refuses (400) if `kind='standard'`. 204 otherwise.
- All four guarded by `requireOwnedReport`.

**UI.** In `ReportEditor.tsx` left sidebar:
- Each section gets a drag handle. Use `@dnd-kit/core` + `@dnd-kit/sortable` (small, accessible, no jQuery). On drop, optimistically reorder, then PATCH; revert on failure.
- A "+ Add custom section" button at the bottom.
- Trash-can icon on custom sections only (server validates).

**Regenerate interaction.** When the full-report regenerate runs, custom sections are always preserved (treat as edited). Tweak `planRegenerate` to skip merging for `kind='custom'`.

**Tests.** ≥10 — schema migration idempotency, all three new endpoints (happy + cross-user + ownership + invalid input), regenerate skips custom, validation that order set equals existing ids exactly.

**File-touch contract.** `src/lib/db.ts`, `src/lib/types.ts`, `src/lib/reportRegenerate.ts`, `src/lib/reportRegenerate.test.ts`, `src/app/api/reports/[id]/sections/route.ts` (new), `src/app/api/reports/[id]/sections/order/route.ts` (new), `src/app/api/reports/[id]/sections/[sectionId]/route.ts` (extend), `src/app/reports/[id]/ReportEditor.tsx`, `test/api.test.ts`, `package.json`.

#### Track B — B-031 — Direct row entry / inline edit — P2 · M

**Goal.** A user can paste/type traffic counts directly without a CSV, and edit individual rows after upload.

**API.**
- `POST /api/projects/:id/traffic-data/rows` — body `{ rows: ParsedTrafficRow[] }`. Appends rows. Reuses validation from `parseTrafficCsv` row-level checks (extract into `validateRow(row): RowIssue[]`).
- `PATCH /api/projects/:id/traffic-data/rows/:rowId` — edit one row.
- `DELETE /api/projects/:id/traffic-data/rows/:rowId` — remove one row.
- All gated by `requireOwnedProject`.

**Repo.** Extend `trafficRepo` with `add`, `updateRow`, `deleteRow`. The existing `replaceForProject` (bulk replace) stays for CSV upload.

**UI.** New section on the project page: "Add row by hand" — six inputs (intersection, period dropdown, approach, inbound, outbound, total) and an "Add" button. Each row in the existing imported-rows table grows an inline edit/save and a delete icon.

**Tests.** ≥8 — append valid, append invalid (400 with row-level issues), edit one, delete one, cross-user 404, repo unit tests.

**File-touch contract.** `src/lib/csv.ts` (extract `validateRow`), `src/lib/csv.test.ts`, `src/lib/db.ts` (extend `trafficRepo`), `src/lib/db.test.ts`, `src/app/api/projects/[id]/traffic-data/rows/route.ts` (new), `src/app/api/projects/[id]/traffic-data/rows/[rowId]/route.ts` (new), `src/app/projects/[id]/UploadCsv.tsx` (or split into `TrafficRowsManager.tsx`), `src/app/projects/[id]/page.tsx` (mount), `test/api.test.ts`.

### Wave 2 (sequential after Wave 1, also parallel-eligible)

#### Track C — B-042b — Password reset + email verification — P1 · M

**Email service: Resend** (default — confirm before execution).

**Setup.**
- `npm i resend`
- `RESEND_API_KEY` and `EMAIL_FROM` env vars. Document in README + `.env.example`.
- New `src/lib/email.ts` — thin wrapper with `sendVerification(to, link)` and `sendPasswordReset(to, link)`. In `NODE_ENV=test`, log to a captured array instead of calling Resend so tests don't hit the network. Flag in tests via `process.env.EMAIL_SINK = 'memory'`.

**Schema.**
- `users.emailVerifiedAt TEXT` — nullable, set when the verification link is hit.
- `password_reset_tokens(token TEXT PRIMARY KEY, userId TEXT, expiresAt TEXT, usedAt TEXT)`.
- `verification_tokens(token TEXT PRIMARY KEY, userId TEXT, expiresAt TEXT)`.
- Tokens expire in 1h (reset) and 24h (verification).

**API.**
- `POST /api/auth/forgot-password` — body `{ email }`. Always returns 200 (don't leak existence). If user exists, generates a token, persists, emails the link.
- `POST /api/auth/reset-password` — body `{ token, newPassword }`. Validates token unused + unexpired, rotates `passwordHash`, marks token used.
- `POST /api/auth/send-verification` — auth-required. Re-sends a verification link.
- `GET /api/auth/verify-email?token=...` — consumes token, sets `emailVerifiedAt`, redirects to `/account?verified=1`.
- Signup flow: after creating user, immediately send verification email (best effort — failure doesn't block signup, surfaces a banner on /account).

**UI.**
- New `/forgot-password` page (email input → submit → "If an account exists, we sent a link.").
- New `/reset-password` page (reads `?token=` from URL, new password + confirm fields).
- `/account` page gains an "Email not verified — resend" affordance when `emailVerifiedAt` is null.
- `/signin` page gets a "Forgot password?" link.

**Tests.** ≥12 — token TTL + single-use, reset rotates hash, signin works with new password, forgot-password doesn't leak existence (timing-safe), verification link sets the column, expired token rejected, used token rejected, unauth send-verification 401, the email sink captures the right `to` and link.

**File-touch contract.** New: `src/lib/email.ts`, `src/lib/email.test.ts`, `src/lib/tokens.ts`, `src/lib/tokens.test.ts`, four new `src/app/api/auth/*` routes, two new pages. Edits: `src/lib/db.ts` (schema + token repo), `src/lib/types.ts`, `src/app/signin/page.tsx` (add forgot link), `src/app/signup/page.tsx` (kick off verification email), `src/app/account/page.tsx` (verification banner). README + .env.example.

#### Track D — B-041 — Per-project sharing (read-only V1) — P2 · L

**Schema.**
- New `project_shares(projectId TEXT, userId TEXT, role TEXT NOT NULL CHECK(role='reader'), createdAt TEXT, PRIMARY KEY(projectId, userId))`. Cascade-delete on both FKs.

**Ownership change.**
- `requireOwnedProject` becomes `requireProjectAccess(projectId, mode: 'read' | 'write')`. Owner has both. Sharee has only 'read'. Return type unchanged for callers; the mode is checked by the helper.
- All write-y routes (PATCH/DELETE/upload-csv/generate-report/section PATCH/section regenerate) require 'write'. All read-y routes (GET, exports) accept 'read'.
- `projectRepo.list(userId)` becomes `listAccessible(userId)` — UNION of owned and shared. Add a `role` column to the list response so the UI can show "Shared with you" and hide write affordances.

**API.**
- `POST /api/projects/:id/shares` — owner-only. Body `{ email }`. Lookup user; if not exists, return 200 with a "user not found" no-op (don't leak — but realistically: with auth, leaking that "user is registered" via the share endpoint is acceptable; revisit when there's a separate org model). Insert `(projectId, userId, 'reader')`.
- `DELETE /api/projects/:id/shares/:userId` — owner-only.
- `GET /api/projects/:id/shares` — owner-only. Returns list of `{ userId, email, name, role }`.

**UI.**
- New "Share" card on the project page — list of current shares + an "Invite by email" form (owner only).
- The project list shows a small "Shared" badge on shared rows.
- On a shared project's detail page, hide Edit / Delete / Upload / Manual Inputs / Generate Report buttons. Reports are read-only — hide section save buttons + regenerate.

**Tests.** ≥10 — owner-only insert, sharee read-only access (200 on GET, 401/403 on writes), share list, share remove, second user can't escalate, project delete cascades shares, list response includes `role`.

**File-touch contract.** Schema + repo in `src/lib/db.ts`, ownership helper in `src/lib/session.ts`, new shares routes, every existing per-project route updated to use the new helper, project page conditional rendering, project list badge.

---

## Phase 2 — Coverage sweep to 95%

After Phase 1's features land, the codebase has roughly: pure libs (mostly covered), route handlers (well covered, ≥1 happy + ≥1 failure each), and ~14 React components + 6 pages (zero coverage).

### Step 1 — Add testing-library

- `npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`
- New `vitest.config.ts` workspace project for component tests with `environment: 'jsdom'`. Keep the existing node project for lib + route tests. Use Vitest's `projects` config.
- `test/dom-setup.ts` — adds `@testing-library/jest-dom` matchers.
- `test/utils/render.tsx` — wraps `render` with a `<MemoryRouterProvider>` (Next has utilities for this) and stubs `next/navigation` hooks via `vi.mock`.

### Step 2 — Component tests (one file per component)

Required cases per component:

| Component                  | Tests |
|----------------------------|-------|
| `ProjectList`              | filter narrows by all 3 fields; each sort option orders; no-projects-yet vs no-matches empty states |
| `ChangePasswordForm`       | validation, success, server error, mismatched confirm |
| `ManualInputsForm`         | edit + save round-trip, error from server |
| `EditProjectForm` (in edit/page.tsx — extract to a sibling component for testability) | validation, save, cancel |
| `UploadCsv` / `TrafficRowsManager` | preview happy path, preview with errors, confirm gating, regenerate confirm modal |
| `ReportEditor`             | section nav, status select, save, regenerate-section confirm flow, banner from query params |
| `DeleteButton`             | confirm modal, fires DELETE, navigates away on 204 |
| `SignOutButton`            | calls signOut |
| `SignIn` / `SignUp` pages  | submit flows, error messages |

**Target:** ≥30 component tests, raising overall line coverage to 95% on `src/app/**`.

### Step 3 — Server-component coverage

Server components (`src/app/**/page.tsx`) call `auth()` and repos. Test by importing and calling them with mocked `auth` and a seeded DB; assert the rendered tree contains the expected text via `renderToString` from `react-dom/server`.

≥6 page tests (home redirect when unauth, project page 404 cross-user, report page redirect when unauth, signin/signup/account pages render).

### Step 4 — Wire coverage gate into CI

- `npm run test:coverage` already exists. Add coverage thresholds in `vitest.config.ts`:
  ```ts
  coverage: {
    thresholds: {
      statements: 95,
      branches: 90,
      functions: 90,
      lines: 95,
    },
    exclude: [
      "src/auth.config.ts",   // edge-only, no logic
      "src/middleware.ts",    // exercised via E2E
      "src/lib/email.ts",     // covered via spy in tests; the network path is excluded
      "src/app/global-error.tsx",
      "**/*.d.ts",
    ],
  }
  ```
- New CI step: `npm run test:coverage` after `npm test`. Hard-fail on threshold misses.
- Generate an HTML report artifact (`coverage/index.html`) and upload it as a workflow artifact.

### Step 5 — Iterate

Run coverage. For each uncovered branch/file, add a focused test or add to the `exclude` list with a justification comment.

**Acceptance:** `npm run test:coverage` exits 0 with the thresholds enforced.

---

## Phase 3 — E2E with Playwright

### Step 1 — Install + scaffold

- `npm i -D @playwright/test`
- `npx playwright install chromium` (CI installs via the official action).
- `playwright.config.ts` — `webServer` runs `npm run build && npm run start` on port 3000 with a unique `ENVDOCOS_DB_PATH=/tmp/e2e-{run}.db`. Single project (chromium). Headless. 30s timeout per test.
- `e2e/` directory at repo root. New `npm run e2e` script: `playwright test`.
- `.gitignore` adds `playwright-report/`, `test-results/`.

### Step 2 — Test fixtures

`e2e/fixtures.ts` — a Playwright fixture that:
- Creates a fresh user via `/api/auth/signup` (different email per test for isolation, ID via crypto.randomUUID).
- Signs in via `/signin` (real browser flow, full Auth.js cookie dance).
- Returns the page authenticated.

### Step 3 — Flows to cover

1. **First-run signup** — fresh DB, signup, lands on `/`, page shows "+ New Project" button.
2. **Project lifecycle** — create → upload sample CSV → generate report → edit a section → save → DOCX download (assert ZIP magic bytes) → PDF download (assert `%PDF`).
3. **Edit + delete project** — edit fields, confirm via reload, delete with confirm modal, redirected to `/`.
4. **Search + sort** — create 3 projects, filter narrows, sort A→Z reorders.
5. **Regenerate preserves edits** — create project + report, edit Executive Summary, regenerate, banner shows preserved=1, edit retained.
6. **Per-section regenerate** — edit section, click "Regenerate from data", confirm → content reset to template.
7. **Cross-user isolation** — user A creates project, user B signs up, B's `/` is empty, B navigates to `/projects/{A's id}` → 404.
8. **Sharing (B-041)** — user A creates project, shares with user B's email, B sees it in list with "Shared" badge, B's project page hides write buttons, B's POST attempts return 403.
9. **Change password** — change via `/account`, sign out, sign in with new password.
10. **Forgot password** — request reset, capture link from in-memory email sink, follow link, set new password, sign in.

### Step 4 — Email sink for E2E

The test webServer runs with `EMAIL_SINK=memory`. A new dev-only endpoint `GET /api/_test/emails` returns the captured emails as JSON. Mounted only when `EMAIL_SINK=memory`. Playwright fetches it to retrieve the reset link.

### Step 5 — CI

- New workflow `.github/workflows/e2e.yml` (or extend existing `ci.yml`):
  - `actions/setup-node@v4`, `npm ci`
  - `npx playwright install --with-deps chromium`
  - `npm run build`
  - `npm run e2e`
  - Upload `playwright-report/` on failure.
- Run on PRs.

**Acceptance:** all 10 E2E tests pass green in CI on a fresh checkout, total run < 4 minutes.

---

## Sequencing summary

```
Wave 1  (parallel)    Track A: B-014        Track B: B-031
Wave 2  (parallel)    Track C: B-042b       Track D: B-041
Phase 2 (sequential)  Component + page tests + coverage gate
Phase 3 (sequential)  Playwright + 10 E2E flows + CI workflow
```

Estimated total: ~3-4 sessions of work across the four feature tracks, ~1 session for coverage sweep, ~1 session for E2E.

## Open risks

- **Resend free tier** is per-day. CI E2E runs hit it if not gated by `EMAIL_SINK=memory`. Solution above.
- **Auth.js v5 + Playwright** session cookies: documented but finicky. Falling back to "make a JWT directly with the same secret and inject the cookie" is the standard workaround if `signIn` form-flow flakes.
- **`@dnd-kit` + Next.js App Router** has a known SSR hydration issue around drag handles — mitigated by client-component-only mount and `dynamic(() => ..., { ssr: false })` if needed.
- **Coverage threshold of 95%** is aggressive on UI. If we can't hit it without low-value tests, lower the bar to 90% statements + add the missing files to `exclude` with rationale rather than write filler tests.

## Followups (deliberately out of scope for 0005)

- Email change flow (different from email verification on signup)
- "Read+write" share role
- Account deletion
- Audit log of project edits
- Multi-tenancy / organizations
- Visual regression tests
