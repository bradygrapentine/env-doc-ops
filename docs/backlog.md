# EnvDocOS Traffic — Backlog

Synthesized from `envdocos_traffic_v1_package_full/docs/`, the V1 README, and gaps observed in the shipped V1.

Status legend: `Ready` (scoped, ready to pick up), `Blocked`, `In progress`, `Shipped`, `Deferred`.

Priority: `P0` (blocks usable product), `P1` (next-up value), `P2` (polish / nice-to-have).

Effort: rough t-shirt — `S` ≤ 1 day, `M` ≤ 3 days, `L` 1+ week.

---

## §0 Status board

| State       | Count |
| ----------- | ----- |
| Ready       | 0     |
| In progress | 0     |
| Blocked     | 0     |
| Shipped     | 24    |

Last `/backlog-sync`: 2026-05-01

---

## §1 Ready

_Empty — V1 backlog is fully shipped._

Followups noted during execution (low priority polish):

- ~~**B-???-test-debt** — `ReportEditor.tsx` and `UploadCsv.tsx` are excluded from coverage.~~ Shipped: 12 ReportEditor + 8 UploadCsv tests; both removed from coverage exclusion list.
- ~~**B-???-cpf-bug** — `e.currentTarget` post-await null in `ChangePasswordForm.tsx`.~~ Fixed: form ref captured synchronously; test-side `unhandledRejection` swallow removed.
- ~~**B-???-edit-form** — `edit/page.tsx` could be split into `EditProjectForm.tsx`.~~ Shipped: extracted with 4 tests.
- ~~**Email change** — different from email-verification-on-signup; no flow yet.~~ Shipped: see B-043.
- ~~**Read+write sharing role** — V1 sharing is read-only; read+write needs a conflict-resolution story.~~ Shipped: see B-044 (last-write-wins is the resolution story; lock down share management to owner-only).
- ~~**Account deletion** — no flow yet.~~ Shipped: see B-045.
- ~~**Audit log of edits** — none.~~ Shipped: see B-046.

---

## §2 Deferred / parking lot

These are explicitly **not** the product (per README "What This Is Not"). Capture so we can push back when stakeholders ask:

- Trip prediction / simulation modeling
- Camera-based count collection
- ML traffic forecasting
- Replacement for a stamped engineering review

If a stakeholder pushes for any of these, see `envdocos_traffic_v1_package_full/docs/01_product_spec.md` and re-anchor on "report compiler, not modeler."

---

## §3 Shipped

- **B-046 — Audit log of edits** · `700af27` · 2026-05-01
  New `audit_log` table + `auditRepo`. Mutation hooks on project update, traffic import, report (re)generate, section add/update/delete/reorder/regenerate, and share add/remove/role-change. Owner-only `GET /api/projects/:id/audit`. AuditPanel on the project page.

- **B-045 — Account deletion** · `700af27` · 2026-05-01
  `DELETE /api/auth/account` verifies the current password via bcrypt then drops the user; FK cascades clean projects, reports, shares, and tokens. `userRepo.delete` helper. New `DeleteAccountSection` armed via two-step confirmation; signs out via callback `/signin?deleted=1`.

- **B-044 — Editor sharing role** · `700af27` · 2026-05-01
  `ShareRole` and `ProjectAccessRole` widened to include `editor`. `requireProjectAccess(_, "write")` lets editors mutate content; share management and project deletion are owner-only. SQLite CHECK constraint widened via in-place migration that recreates `project_shares`. SharesPanel exposes role selectors for invite + per-share role change. New `PATCH /api/projects/:id/shares/:userId` endpoint.

- **B-043 — Email change flow** · `700af27` · 2026-05-01
  `email_change_tokens` table with 1-hour TTL. `POST /api/auth/change-email` verifies the current password, sends a confirmation link to the new address. `GET /api/auth/confirm-email-change` consumes the token and rotates the email; conflict (race with another signup) lands at `/account?email_change=conflict`. Account page exposes `ChangeEmailForm` and a status banner.

- **Followups — coverage push to 95%** · `f03d768`, `700af27` · 2026-05-01
  Component coverage on `ReportEditor`, `UploadCsv`, `TrafficRowsManager`, `SharesPanel`, `EditProjectForm`, plus tests for the new account/audit flows. 333 tests; 91.6% statements / 94.8% lines / 88% functions / 82% branches. Tightened thresholds: libs 95% lines, api 90%, ui 85%. `auth.ts`, the `[...nextauth]` trampoline, and the `test-only/emails` route excluded with documented reasons.

- **Followups — ChangePasswordForm bug fix + EditProjectForm extraction** · `05bc0c3` · 2026-05-01
  Captured `form = e.currentTarget` synchronously in `ChangePasswordForm` so `form.reset()` works after the awaited fetch. Removed the test-side `unhandledRejection` swallow that was hiding the bug. Extracted `EditProjectForm.tsx` from `edit/page.tsx` with 4 new tests.

- **Phase 2 — Coverage gate + component/page tests** · `4db9a8e` · 2026-04-30
  Vitest projects split (node + jsdom). 67 new tests across components and pages. Coverage thresholds enforced in CI: `src/lib/**` 90/75/95/90, `src/app/api/**` 80/70/75/85, `src/app/**` 50/50/50/55. Targets relaxed from plan's 95/90/90/95 due to Auth.js v5 internal branches not reachable from unit tests + complex client components excluded for follow-up.

- **Phase 3 — Playwright E2E suite** · `ebf7709` · 2026-04-30
  11 flows covering signup, project lifecycle, DOCX/PDF, edit/delete, search/sort, regenerate-preserves-edits, section regenerate, cross-user isolation, sharing, change password, forgot password. Test-only `/api/test-only/emails` endpoint exposes the in-memory email sink. CI workflow runs the suite on PRs. Total run ~10s locally.

- **B-014 — Section reorder + custom sections** · `2ee760d` · 2026-04-30
  `report_sections.kind` ('standard'|'custom'). New endpoints under `/api/reports/:id/sections/*` for reorder/add/delete (delete refuses standard). Editor uses `@dnd-kit/sortable` for drag-to-reorder with optimistic local state. Custom sections always preserved across regenerate.

- **B-031 — Direct row entry / inline edit / delete** · `359b9ad` · 2026-04-30
  Extracted `validateRow` from CSV path. New row-level endpoints. New `TrafficRowsManager` client component with inline edit/delete and an "Add row" form.

- **B-041 — Per-project sharing (read-only)** · `7707f02` · 2026-04-30
  New `project_shares` table. `requireProjectAccess` / `requireReportAccess` with mode `'read'|'write'`. GET / DOCX / PDF accept readers; all writes are owner-only. Owner-only Shares panel; "Shared" badge on the project list.

- **B-042b — Password reset + email verification** · `3731672` · 2026-04-30
  Resend integration with in-memory sink for tests/E2E. Token tables + repos. New forgot/reset/verify routes + pages. Account page banner + resend button for unverified users. Verification email kicked off on signup.

- **B-013 — Per-section regenerate** · `56b6e93` · 2026-04-30
  New `POST /api/reports/:id/sections/:sectionId/regenerate` that re-runs the template for one section, resets status to draft, and bumps `machineBaseline`. Editor button next to "Save section" with a confirm dialog.

- **B-032b — Wire growthRate + mitigationNotes into templates** · `047bb97` · 2026-04-30
  `growthRate` appends a sentence to impact-analysis; `mitigationNotes` appends an "Engineer notes" paragraph to mitigation. Empty values leave canned text unchanged.

- **B-042 (partial) — In-app change password** · `ca16f4d` · 2026-04-30
  `POST /api/auth/change-password` verifies current password via bcrypt and rotates to a new one (≥8 chars). New `/account` page with read-only profile + change-password form. Header has Account link for signed-in users. Password reset / email verification deferred to B-042b (needs SMTP).

- **B-040 — Real auth (email + password)** · 2026-04-30
  Auth.js v5 with Credentials provider + bcryptjs. New `users` table, `projects.userId` column, middleware redirects unauth pages and 401s API routes. Signup adopts pre-existing orphan projects on first user. Cross-user isolation enforced (404 on others' projects). Test backdoor via `AUTH_TEST_USER_ID` env (NODE_ENV=test only).

- **B-012 — PDF export** · `dfa56c3` · 2026-04-30
  `pdfkit`-rendered PDF mirroring the DOCX structure: cover page, numbered section headings, peak summary + per-row traffic table inside Existing Conditions. Editor has Export PDF button next to Export DOCX. Required marking `pdfkit` as a server-external package in `next.config.mjs` so its AFM font files resolve at runtime.

- **B-030 — CSV upload diff preview** · `85bf37f` · 2026-04-30
  New `parseTrafficCsvDetailed` walks every row and reports per-row issues instead of bailing on first error. Preview endpoint at `…/traffic-data/preview`. UploadCsv now shows a per-row table with invalid rows highlighted; Confirm button gated on zero issues.

- **B-032 — Manual project inputs (V1 slice)** · `003a97e` · 2026-04-30
  `manualInputs` JSON column with four optional string fields. PATCH route accepts the object. Form on the project page edits and saves them. `tripGenAssumptions` and `engineerConclusions` override their canned section text when set; the other two are stored only (followup B-032b).

- **B-002 — Prettier + npm run check** · `063a60e` · 2026-04-30
  Prettier 3.8 + `.prettierrc` + format/format:check/check scripts. Codebase reformatted to the new style.

- **B-020 — Project edit** · `25d855c` · 2026-04-30
  `PATCH /api/projects/:id` for editable fields, branded edit page prefilled from the existing project, ignores `id`/`createdAt` patches. 7 new API tests.

- **B-021 — Project delete** · `25d855c` · 2026-04-30
  `DELETE /api/projects/:id` with cascade verified end-to-end (project → traffic counts → reports → sections). Confirm modal on the project page.

- **B-022 — Project search + sort on `/`** · `ef176fa` · 2026-04-30
  Client-side filter (name/location/jurisdiction substring) + sort dropdown (newest, oldest, name A→Z, name Z→A). Empty state distinguishes "no projects yet" from "no matches."

- **B-003 — Error boundary + 404/500 pages** · `76ed9e8` · 2026-04-30
  Branded `error.tsx`, `not-found.tsx`, `global-error.tsx` matching the app's card aesthetic.

- **B-011 — Regenerate report without losing edits** · `c36554a` · 2026-04-30
  Schema migration adds `machineBaseline`. Generate-report now merges fresh template output with user edits: sections that are reviewed/final, or whose content differs from the last machine output, are preserved. New `/generate-report/preview` endpoint powers a confirm modal, and the editor shows a refreshed/preserved banner.

- **B-010 — DOCX export with traffic tables + cover page** · `f90781a` · 2026-04-30
  Cover page with title, project info block, page break. Existing Conditions section embeds two tables: AM/PM peak summary + per-row counts sorted by intersection then period.

- **B-001 — Tests & CI scaffold** · `501623e` · 2026-04-30
  Vitest with 47 tests across csv parsing, report generation, regenerate logic, DOCX export, and all 8 API routes. GitHub Actions CI runs lint/typecheck/test/build on every PR.

- **B-V1 — V1 build** · `e8085dd` · 2026-04-30
  Project CRUD (create only), CSV upload + validation, metrics, template report generation, editable sections, DOCX export. End-to-end smoke-tested.
