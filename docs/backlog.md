# EnvDocOS Traffic — Backlog

Synthesized from `envdocos_traffic_v1_package_full/docs/`, the V1 README, and gaps observed in the shipped V1.

Status legend: `Ready` (scoped, ready to pick up), `Blocked`, `In progress`, `Shipped`, `Deferred`.

Priority: `P0` (blocks usable product), `P1` (next-up value), `P2` (polish / nice-to-have).

Effort: rough t-shirt — `S` ≤ 1 day, `M` ≤ 3 days, `L` 1+ week.

---

## §0 Status board

| State       | Count |
| ----------- | ----- |
| Ready       | 3     |
| In progress | 0     |
| Blocked     | 0     |
| Shipped     | 13    |

---

## §1 Ready

### Report quality (the actual deliverable)

- **B-013 — Per-section regenerate** · P2 · S
  Button on the editor: "Regenerate this section from latest data" — re-runs the template for one section without touching others. Composes with B-011.

- **B-014 — Section reorder + add/remove custom sections** · P2 · M
  Drag-to-reorder and add a freeform "Custom" section. Schema already has `order`.

### Project lifecycle

### Data input

- **B-031 — Direct row entry / inline edit of count rows** · P2 · M
  Some firms don't have a CSV — let them paste a small set of counts. Expand `traffic_counts` writes beyond the bulk replace path.

- **B-032b — Wire growthRate + mitigationNotes into report templates** · P1 · S
  Followup from B-032: those two `manualInputs` fields are stored but not yet threaded into `impact-analysis` and `mitigation` section templates. TODO comment is in `src/lib/reportGenerator.ts`.

### Auth & multi-user

- **B-041 — Per-project sharing** · P2 · L
  Invite a collaborator by email; read or read+write. Depends on B-040.

- **B-042 — Account management (password reset, email verification)** · P1 · M
  Followup from B-040: forgot-password flow, email verification, change-password. Requires SMTP/Resend.

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
