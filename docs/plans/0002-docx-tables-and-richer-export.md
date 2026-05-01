# Plan 0002 — DOCX export with traffic tables + cover page

Backlog: **B-010** · Priority **P0** · Effort **M**

## Goal

The current DOCX is just `H1` + paragraphs. Engineers expect a real report layout: a cover page, a tabular traffic-counts summary per intersection, and consistent heading hierarchy. This is the most visible quality jump for the actual deliverable and the one a partner demo will judge us on.

## Why now

The product's wedge is "60-80% of a draft." A draft without tables is closer to 20%. Every other improvement (PDF, regenerate, manual inputs) routes through this same export path — get the layout right once and the rest compose cleanly.

## Depends on

- **B-001 (tests/CI)** should land first so the new docx code has a unit test.

## Scope

In:
- A standalone cover page with project name, location, jurisdiction, prepared-by, date.
- A heading hierarchy: `Title` → `Heading 1` (numbered sections) → `Heading 2` (sub-blocks) → body paragraphs.
- A traffic counts table inserted into the **Existing Conditions** section: one row per `(intersection, period)` group, columns `Intersection`, `Period`, `Approach`, `Inbound`, `Outbound`, `Total`.
- A peak-volumes summary mini-table: `AM Peak`, `PM Peak`, intersection + total.
- Page break after the cover page.
- Document properties (title, creator) populated.

Out (separate stories):
- Page numbers / running headers (B-014).
- Embedded figures / maps (out — not the product).
- PDF export (B-012, separate plan).
- Custom user templates (B-014).

## Acceptance criteria

1. Exported `.docx` opens cleanly in Microsoft Word and Google Docs (no warnings, no "recovered file" prompts).
2. Cover page renders project name as `Title`, then a 5-row info block, then a manual page break.
3. Existing Conditions section contains a table with N rows where N = traffic count rows for that project, sorted by intersection then period.
4. Existing Conditions also contains a 2-row peak-volume summary table.
5. Each of the 8 report sections is a `Heading 1` with the section number prefix.
6. The unit test from Plan 0001 still passes (extract `word/document.xml`, assert all 8 section titles appear) and a new test asserts the table with the right cell count is present.
7. File size for the sample CSV report stays under 25 KB.

## Implementation steps

### Step 1 — Extend `buildReportDocx` signature

`buildReportDocx` currently takes `(project, report)`. The table needs the raw `traffic_counts` rows. Two options:

- (A) Pass `rows` as a third arg.
- (B) Have the route fetch rows and pass them in.

Pick (A). Update the call site in `src/app/api/reports/[id]/export-docx/route.ts` to also call `trafficRepo.listByProject(report.projectId)` and pass the result.

**Verify:** typecheck green; existing route test from Plan 0001 still passes after updating its fixture.

### Step 2 — Cover page builder

Add an internal `buildCoverPage(project, report)` returning a `Paragraph[]`. Layout:

```
Title:           Traffic Impact Report
Subtitle:        <project.name>

Location:        <project.location>
Jurisdiction:    <project.jurisdiction>
Client:          <project.clientName ?? "—">
Prepared by:     <project.preparedBy ?? "—">
Date:            <new Date(report.updatedAt).toLocaleDateString()>

[page break]
```

Use `docx`'s `PageBreakBefore` paragraph property on the next paragraph (or insert a `Paragraph({ children: [new PageBreak()] })`). Keep the cover page in the same `Section` as body — Word handles the page break.

**Verify:** Open the file in Word; cover page is visually distinct from body.

### Step 3 — Traffic counts table

Add `buildTrafficTable(rows)` returning a `Table` from `docx`. Sort rows by `(intersection, period)`. Columns:

| Intersection | Period | Approach | Inbound | Outbound | Total |
|---|---|---|---|---|---|

Header row uses `TableRow` + `TableCell` with bold `TextRun`. `WidthType.PERCENTAGE` so Word sizes columns. Apply borders via `BorderStyle.SINGLE`.

**Verify:** Snapshot test — extract the docx, parse `word/document.xml`, assert `<w:tbl>` exists, assert N+1 `<w:tr>` (header + N data rows).

### Step 4 — Peak summary table

Compute peak from existing `calculateMetrics(rows)` (already in `lib/reportGenerator.ts`). Render a 2-row, 3-col table:

| Period | Intersection | Total |
|---|---|---|
| AM Peak | … | … |
| PM Peak | … | … |

If `metrics.highestAmIntersection` is undefined, render a single row "No AM-period data."

### Step 5 — Wire into Existing Conditions

In the section loop, when section.id === `"existing-conditions"`:

1. Emit the existing paragraph (template text).
2. Append the peak summary table.
3. Append a small heading "Counts by intersection".
4. Append the full traffic table.

For all other sections, behavior is unchanged.

**Verify:** Manual export with the sample CSV — Existing Conditions now has both tables.

### Step 6 — Heading hierarchy + numbering

Replace the current `Heading 1` for the title with `Title`. Section headings stay `Heading 1` but include the order prefix already (`"1. Executive Summary"`). No numbering rules — the prefix is in the text itself, which is robust across Word/Docs.

### Step 7 — Document properties

Set `creator: "EnvDocOS Traffic V1"` and `title: \`Traffic Impact Report — ${project.name}\`` in the `Document` constructor `creator` / `title` fields. These show up in Word's File → Info pane.

### Step 8 — Update unit test

Extend `src/lib/docx.test.ts` (from Plan 0001):

- New case: when `rows` is non-empty, `<w:tbl>` appears in the XML at least twice (peak table + counts table).
- New case: each row's intersection name appears in the XML at least once.
- New case: cover page contains the project name and the prepared-by string.

## Test plan

- [ ] `npm test` green
- [ ] Manual: download a report, open in Microsoft Word — no warnings, cover + tables render.
- [ ] Manual: open same file in Google Docs — tables render (Docs is fussier than Word about borders).
- [ ] File size <25 KB for sample CSV report.

## Risks / open questions

- **Borders on Google Docs.** Google Docs sometimes drops borders that Word renders. If borders are missing in the manual check, switch to `BorderStyle.SINGLE` with explicit `size: 1, color: "000000"` on every cell — verbose but portable.
- **Page break behavior.** The `docx` package's `PageBreak` works inside a `Paragraph`. If the cover page bleeds into body content in some renderers, switch to two `Section` objects in `Document({ sections: [...] })` — one for cover, one for body — which gives a hard section break.
- **Large CSVs.** A project with 500+ count rows produces a long table. Out of scope for this plan, but flag as a follow-up: paginate or summarize.

## File touches

- Edit: `src/lib/docx.ts` (rewrite)
- Edit: `src/app/api/reports/[id]/export-docx/route.ts` (pass rows)
- Edit: `src/lib/docx.test.ts` (new assertions)
- No schema or API-shape changes. No client-side changes.
