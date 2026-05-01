# EnvDocOS Traffic V1

A traffic impact report compiler. Takes project metadata + a CSV of existing traffic counts and produces an editable, structured report with DOCX export.

This app is **not** traffic modeling software — no prediction, no simulation, no analytics. It assembles draft report sections so a licensed engineer can review and finalize.

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

### Demo flow

1. Click **+ New Project** and create a project (sample values: name `West Loop Mixed Use`, location `123 Main St, Chicago, IL`, jurisdiction `Chicago`, project type `Mixed-use development`, summary `120 residential units and 15,000 sq ft of retail`).
2. On the project page, upload `sample_data/sample_traffic_counts.csv`.
3. Click **Generate Report**.
4. Edit any section in the report editor. Click **Save section**.
5. Click **Export DOCX** to download the report.

## Stack

- Next.js 14 (App Router) + TypeScript + TailwindCSS
- `better-sqlite3` for persistent V1 storage (`data/envdocos.db`)
- `papaparse` for CSV parsing
- `docx` for Word export

## CSV format

Required columns: `intersection,period,approach,inbound,outbound,total`. `period` must be one of `AM`, `PM`, `MIDDAY`, `OTHER`. `approach` is optional. `inbound`, `outbound`, `total` must be numbers.

Re-uploading replaces all rows for that project.

## Project layout

```
src/
  app/
    page.tsx                                     # / project list
    projects/new/page.tsx                        # create project
    projects/[id]/page.tsx                       # dashboard + upload
    reports/[id]/page.tsx                        # report editor
    api/
      projects/route.ts                          # GET, POST
      projects/[id]/route.ts                     # GET
      projects/[id]/traffic-data/route.ts        # POST CSV
      projects/[id]/generate-report/route.ts     # POST
      reports/[id]/route.ts                      # GET
      reports/[id]/sections/[sectionId]/route.ts # PATCH
      reports/[id]/export-docx/route.ts          # POST → .docx
  lib/
    db.ts              # better-sqlite3 setup + repos
    types.ts           # shared types
    csv.ts             # CSV parse + validation
    reportGenerator.ts # metrics + section templates
    docx.ts            # DOCX export
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

## V1 limits

- Single-user, no auth.
- Report regeneration overwrites the report; manual edits are lost. (V2: merge.)
- DOCX is plain heading + paragraph layout — no tables, no figures.
- Trip generation, mitigation, conclusion sections are stub templates by design — to be filled by the engineer.
