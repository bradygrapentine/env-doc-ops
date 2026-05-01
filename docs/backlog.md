# EnvDocOS Traffic — Backlog

Synthesized from `envdocos_traffic_v1_package_full/docs/`, the V1 README, and gaps observed in the shipped V1.

Status legend: `Ready` (scoped, ready to pick up), `Blocked`, `In progress`, `Shipped`, `Deferred`.

Priority: `P0` (blocks usable product), `P1` (next-up value), `P2` (polish / nice-to-have).

Effort: rough t-shirt — `S` ≤ 1 day, `M` ≤ 3 days, `L` 1+ week.

---

## §0 Status board

| State        | Count |
|--------------|-------|
| Ready        | 8     |
| In progress  | 3     |
| Blocked      | 0     |
| Shipped      | 4     |

---

## §1 Ready

### Foundations

- **B-002 — Lint + format hygiene** · P1 · S
  Confirm `next lint` passes; add `eslint-config-next` rules and a Prettier config. Add `npm run check` aggregate.

- **B-003 — Error boundary + 404 / 500 pages** · P1 · S · *(in progress — Track C)*
  App Router `error.tsx`, `not-found.tsx` at root and per route group. Today an exception in a route handler shows the default Next error.

### Report quality (the actual deliverable)

- **B-012 — PDF export** · P1 · M
  Spec lists PDF as "later." Add `POST /api/reports/:id/export-pdf` returning `application/pdf`. Use `docx` → HTML → headless Chromium, or render directly via `pdfkit` / `@react-pdf/renderer`.

- **B-013 — Per-section regenerate** · P2 · S
  Button on the editor: "Regenerate this section from latest data" — re-runs the template for one section without touching others. Composes with B-011.

- **B-014 — Section reorder + add/remove custom sections** · P2 · M
  Drag-to-reorder and add a freeform "Custom" section. Schema already has `order`.

### Project lifecycle

- **B-020 — Project edit** · P0 · S · *(in progress — Track A)*
  No way to update a project after creation. Add `PATCH /api/projects/:id` and an edit form on the project page.

- **B-021 — Project delete** · P0 · S · *(in progress — Track A)*
  `DELETE /api/projects/:id` with confirmation modal. Cascade is already in the SQLite schema.

- **B-022 — Project search + sort on `/`** · P2 · S · *(in progress — Track B)*
  Once there are >10 projects, the list is unusable. Client-side filter input + sort by name / created date.

### Data input

- **B-030 — CSV upload diff preview** · P1 · M
  Before commit, show the parsed table with row/column-level errors highlighted. Today the user just sees a single error string from the API.

- **B-031 — Direct row entry / inline edit of count rows** · P2 · M
  Some firms don't have a CSV — let them paste a small set of counts. Expand `traffic_counts` writes beyond the bulk replace path.

- **B-032 — Manual inputs (growth rate, trip gen assumptions, mitigation notes)** · P1 · M
  Spec §1 lists these as "Optional Manual Inputs." Add a key-value side panel on the project page; pipe values into the report templates.

### Auth & multi-user

- **B-040 — Single-user auth (email / magic link)** · P1 · M
  V1 has zero auth. Add NextAuth.js with magic-link, scope projects to the authenticated user.

- **B-041 — Per-project sharing** · P2 · L
  Invite a collaborator by email; read or read+write. Depends on B-040.

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

- **B-011 — Regenerate report without losing edits** · `c36554a` · 2026-04-30
  Schema migration adds `machineBaseline`. Generate-report now merges fresh template output with user edits: sections that are reviewed/final, or whose content differs from the last machine output, are preserved. New `/generate-report/preview` endpoint powers a confirm modal, and the editor shows a refreshed/preserved banner.

- **B-010 — DOCX export with traffic tables + cover page** · `f90781a` · 2026-04-30
  Cover page with title, project info block, page break. Existing Conditions section embeds two tables: AM/PM peak summary + per-row counts sorted by intersection then period.

- **B-001 — Tests & CI scaffold** · `501623e` · 2026-04-30
  Vitest with 47 tests across csv parsing, report generation, regenerate logic, DOCX export, and all 8 API routes. GitHub Actions CI runs lint/typecheck/test/build on every PR.

- **B-V1 — V1 build** · `e8085dd` · 2026-04-30
  Project CRUD (create only), CSV upload + validation, metrics, template report generation, editable sections, DOCX export. End-to-end smoke-tested.
