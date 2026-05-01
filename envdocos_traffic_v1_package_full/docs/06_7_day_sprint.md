# 7-Day Build Sprint

## Day 1: App Scaffold
- Create Next.js app
- Add Tailwind
- Define TypeScript models
- Create basic routes/pages

## Day 2: Project Form
- Build create project page
- Store project locally or in SQLite/Postgres
- Add project detail page

## Day 3: CSV Upload
- Add CSV upload component
- Parse with PapaParse
- Validate required columns
- Display imported rows

## Day 4: Metrics Engine
- Calculate AM/PM totals
- Identify peak intersections
- Generate intersection list
- Store derived metrics

## Day 5: Report Generator
- Build template interpolation engine
- Generate structured sections
- Render editable report editor

## Day 6: DOCX Export
- Add docx package
- Convert sections into DOCX
- Add download button

## Day 7: Polish + Partner Demo
- Add sample CSV
- Add error messages
- Improve styling
- Prepare demo script

## Demo Script
1. Create a sample project
2. Upload CSV
3. Generate report
4. Edit one section
5. Export DOCX
6. Ask: “How close is this to something useful?”

---

## Status — what actually shipped

The 7-day plan above describes the V1 build (commit `e8085dd`, 2026-04-30). Everything past V1 is tracked in `docs/backlog.md` §3 (Shipped). High-level summary as of 2026-05-01:

- **Auth** — Auth.js v5 + Credentials, email verification, forgot/reset password, change password, change email, account deletion.
- **Sharing** — Per-project shares with `reader` and `editor` roles; share management is owner-only.
- **Editor** — Drag-to-reorder, custom sections, per-section regenerate, refreshed/preserved banner.
- **Exports** — DOCX with cover page + traffic tables; PDF mirroring DOCX.
- **CSV** — Diff-preview before import; manual row CRUD inline on the project page.
- **Audit** — Per-project activity feed (owner-only).
- **Quality** — 333 unit tests, 11 Playwright E2E flows, CI runs lint/typecheck/test/coverage/build/E2E. Coverage thresholds enforced (libs 95% lines, api 90%, ui 85%).

For the build order including post-V1 work, see `docs/plans/0001..0005-*.md`.
