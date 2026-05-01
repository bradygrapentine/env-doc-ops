# EnvDocOS Traffic V1

A traffic impact report compiler. Takes project metadata + a CSV of existing traffic counts and produces an editable, structured report with DOCX export.

This app is **not** traffic modeling software — no prediction, no simulation, no analytics. It assembles draft report sections so a licensed engineer can review and finalize.

## Quick start

```bash
npm install
echo "AUTH_SECRET=$(openssl rand -base64 32)" > .env.local
npm run dev
```

Then open http://localhost:3000. You'll be redirected to `/signup` to create the first account; that account adopts any pre-existing demo data.

### Demo flow

1. Click **+ New Project** and create a project (sample values: name `West Loop Mixed Use`, location `123 Main St, Chicago, IL`, jurisdiction `Chicago`, project type `Mixed-use development`, summary `120 residential units and 15,000 sq ft of retail`).
2. On the project page, upload `sample_data/sample_traffic_counts.csv`.
3. Click **Generate Report**.
4. Edit any section in the report editor. Click **Save section**.
5. Click **Export DOCX** to download the report.

## Stack

- Next.js 14 (App Router) + TypeScript + TailwindCSS
- `better-sqlite3` for persistent V1 storage (`data/envdocos.db`)
- Auth.js v5 (`next-auth@beta`) + `bcryptjs` for email/password auth
- `papaparse` for CSV parsing
- `docx` for Word export, `pdfkit` for PDF
- `@dnd-kit/sortable` for editor section reorder
- Resend for transactional email (verification, password reset, email change)

## Environment variables

See `.env.example`. Quick reference:

- `AUTH_SECRET` — required. Used by Auth.js v5.
- `ENVDOCOS_DB_PATH` — optional SQLite path (defaults to `./data/envdocos.db`).
- `RESEND_API_KEY`, `EMAIL_FROM` — required to actually send verification + password-reset
  emails in production. In dev they can be left blank: the email wrapper logs a warning
  and silently no-ops, so signup and forgot-password keep working.
- `EMAIL_SINK=memory` — capture emails in an in-memory array (used by tests + E2E).
  Tests force this on via `NODE_ENV=test`.

## CSV format

Required columns: `intersection,period,approach,inbound,outbound,total`. `period` must be one of `AM`, `PM`, `MIDDAY`, `OTHER`. `approach` is optional. `inbound`, `outbound`, `total` must be numbers.

Re-uploading replaces all rows for that project.

## Project layout

```
src/
  app/
    page.tsx                       # project list
    signin/, signup/               # Auth.js Credentials pages
    forgot-password/, reset-password/
    account/                       # profile, change email/password, delete
    projects/new/                  # create project
    projects/[id]/                 # dashboard + CSV + shares + audit
    projects/[id]/edit/            # edit project fields
    reports/[id]/                  # report editor
    api/
      auth/{signup,forgot-password,reset-password,verify-email,
            send-verification,change-password,change-email,
            confirm-email-change,account}/route.ts
      auth/[...nextauth]/          # Auth.js trampoline
      projects/route.ts            # GET, POST
      projects/[id]/route.ts       # GET, PATCH, DELETE
      projects/[id]/traffic-data/{route,preview,rows,rows/[rowId]}.ts
      projects/[id]/generate-report/{route,preview}.ts
      projects/[id]/shares/[userId]/route.ts
      projects/[id]/audit/route.ts
      reports/[id]/{route,export-docx,export-pdf}.ts
      reports/[id]/sections/{route,order,[sectionId],
                              [sectionId]/regenerate}.ts
  lib/
    db.ts, types.ts, csv.ts, reportGenerator.ts,
    reportRegenerate.ts, docx.ts, pdf.ts, email.ts,
    tokens.ts, session.ts
sample_data/sample_traffic_counts.csv
data/                  # SQLite db lives here (gitignored)
```

## Spec

The full V1 product spec is in `envdocos_traffic_v1_package_full/docs/`:

- `01_product_spec.md` — scope and success criteria
- `02_report_template.md` — section templates and placeholders
- `03_schema.md` — data model
- `04_api_spec.md` — REST endpoints
- `05_ui_design.md` — screen designs
- `06_7_day_sprint.md` — build order
- `07_claude_code_prompt.md` — original build prompt

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm start` — production server
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — Next.js ESLint
- `npm test` — Vitest (333 unit + route + component tests)
- `npm run test:watch` — Vitest watch mode
- `npm run test:coverage` — Vitest with V8 coverage
- `npm run e2e` — Playwright E2E suite (see below)
- `npm run e2e:ui` — Playwright in headed UI mode

## End-to-end tests

The Playwright suite lives in `e2e/` and exercises 11 user flows (signup,
project lifecycle, DOCX/PDF export, edit/delete, search/sort,
regenerate-preserves-edits, section regenerate, cross-user isolation,
sharing, change password, forgot password).

Quick start:

```bash
npm run build                  # required: webServer runs `next start`
AUTH_SECRET=e2e-secret npm run e2e
```

Notes:

- The webServer launches on port 3460 with `EMAIL_SINK=memory` and a
  per-run sqlite db at `/tmp/e2e-<pid>-<ts>.db`, so tests don't collide
  with your dev server.
- The forgot-password test fetches `/api/test-only/emails`. That endpoint is
  test-only and returns 404 unless `EMAIL_SINK=memory`.

## Current state (2026-05-01)

- Email + password auth (Auth.js v5 + bcryptjs). Email verification, password reset, change password, change email, account deletion all in.
- Per-project sharing with `reader` and `editor` roles. Editors can mutate content; share management and project deletion are owner-only.
- Owner-only audit log of project / share / section / report mutations on the project page.
- Regenerating a report refreshes machine-generated draft sections; sections you've reviewed or edited are preserved (with a confirmation prompt before the run). Per-section regenerate is also available.
- DOCX export includes a cover page and an Existing Conditions traffic table (AM/PM peak summary + per-row counts). PDF export mirrors the DOCX structure.
- Trip generation, mitigation, conclusion sections are stub templates by design — to be filled by the engineer. `manualInputs` (`growthRate`, `tripGenAssumptions`, `mitigationNotes`, `engineerConclusions`) override the canned text where set.

For the live backlog see `docs/backlog.md`. For the original V1 spec see `envdocos_traffic_v1_package_full/docs/`; each spec doc has an "Addenda" section pointing to current behavior.
