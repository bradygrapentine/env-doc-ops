# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

Pre-implementation spec package. No app code, no `package.json`, no tests, no commits yet. The real Next.js app described by the docs has **not been built**.

Two top-level directories:

- `envdocos_traffic_v1_package_full/` — **canonical spec package**. Read this first.
- `envdocos_v1_retry/` — earlier stub (1-line `reportGenerator.ts`, 1-line spec). Treat as scratch unless the user says otherwise.

## Build Prompt

The authoritative build instruction for this project is `envdocos_traffic_v1_package_full/docs/07_claude_code_prompt.md`. When asked to "build EnvDocOS Traffic V1" or implement this app, follow that prompt — do not improvise scope.

## Product Constraints (do not violate)

EnvDocOS Traffic V1 is a **report compiler**, not traffic engineering software. Per `docs/01_product_spec.md` and the build prompt:

- **Do not build:** traffic prediction, simulation, camera analytics, ML/forecasting, data collection.
- **Do build:** CSV ingest → metrics → template-interpolated report sections → editable UI → DOCX export.
- The output is a draft for a licensed engineer to review and stamp. Templates live in `docs/02_report_template.md`.

## Spec Map

When implementing, each doc owns one concern — consult them rather than re-deriving:

- `docs/01_product_spec.md` — scope, inputs, success criteria
- `docs/02_report_template.md` — section text and `{{placeholder}}` tokens (use these verbatim)
- `docs/03_schema.md` — `Project`, `TrafficCountRow`, `Report`, `ReportSection`, `TrafficMetrics` types (mirrored in `src/types.ts`)
- `docs/04_api_spec.md` — REST endpoints (`/api/projects`, `/api/projects/:id/traffic-data`, `/api/projects/:id/generate-report`, `/api/reports/:id`, `PATCH …/sections/:sectionId`, `/api/reports/:id/export-docx`)
- `docs/05_ui_design.md` — four screens: create project, upload CSV, report editor (3-pane), export
- `docs/06_7_day_sprint.md` — build order if working day-by-day

## Stack (from build prompt + `package.example.json`)

Next.js + TypeScript + TailwindCSS, PapaParse for CSV, `docx` + `file-saver` for export, in-memory or SQLite storage for V1. `package.example.json` is the seed for the real `package.json` — copy and rename when scaffolding.

## Required Pages

`/`, `/projects/new`, `/projects/[id]`, `/reports/[id]`.

## CSV Schema

Minimum required columns (see spec — do not invent extras for V1):

```
intersection,period,approach,inbound,outbound,total
```

`period` is `"AM" | "PM" | "MIDDAY" | "OTHER"`. Sample at `envdocos_traffic_v1_package_full/sample_data/sample_traffic_counts.csv`.

## Commands

None yet — no `package.json`. After scaffolding, the seed scripts are `next dev` / `next build` / `next start`.
