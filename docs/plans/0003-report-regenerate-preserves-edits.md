# Plan 0003 — Regenerate report without losing edits

Backlog: **B-011** · Priority **P0** · Effort **M**

## Goal

Today, `POST /api/projects/:id/generate-report` overwrites the report's sections wholesale. If the user has edited the Executive Summary, re-uploaded a corrected CSV, and clicked **Generate Report**, their edit is silently lost. This is the single biggest data-loss risk in V1, called out explicitly in `README.md` under "V1 limits."

After this plan: regenerating after a CSV change refreshes machine-generated content but **preserves** any section the user has actively reviewed or edited.

## Why now

Engineers iterate. They upload, generate, edit, find a CSV typo, fix it, regenerate. The current behavior punishes that workflow. Until this is fixed, the practical guidance to users is "never regenerate after editing" — which makes the demo brittle.

## Depends on

- **B-001 (tests/CI)** — the merge logic has enough cases that we want unit-test coverage before shipping it.

## Scope

In:

- Persist a "machine-generated baseline" for each section alongside the editable content.
- On regenerate: for each section, decide **keep user content** vs **overwrite with new machine output** based on a clear rule set.
- Surface a per-section "regenerated" / "preserved (user-edited)" badge in the editor for one navigation cycle so the user can see what changed.
- A dry-run preview endpoint so the UI can show "X sections will be refreshed, Y preserved" before the user confirms.

Out (separate stories):

- Per-section regenerate button (B-013) — composes with this but is a separate UI affordance.
- Three-way merge / textual diff inside a single section (deferred — too much UX surface for V1).
- Undo / version history (deferred — interesting but out of scope).

## Decision rule

A section is **preserved** (not overwritten) if **any** of:

1. `status` is `reviewed` or `final` (user has explicitly graduated it past `draft`).
2. `content` differs from the section's `machineBaseline` (user edited the text).

Otherwise: **regenerate**. This means an untouched `draft` section gets refreshed — exactly what the user wants when they fix the CSV and re-run.

A preserved section's `machineBaseline` is **still updated** to the latest machine output. That way, the next regenerate compares against the freshest baseline, not a stale one.

## Acceptance criteria

1. Schema migration adds `machineBaseline TEXT NOT NULL` to `report_sections` and backfills it with the current `content`.
2. `POST /api/projects/:id/generate-report` returns `{ reportId, refreshed: string[], preserved: string[] }` listing section ids in each bucket.
3. New endpoint `POST /api/projects/:id/generate-report/preview` returns the same shape but does not write anything.
4. After regenerate, sections in `preserved` retain their previous `content` and `status` exactly.
5. After regenerate, sections in `refreshed` have new `content` matching `generateReportSections(project, rows)` output and `status === 'draft'`.
6. The editor shows a transient banner: "5 sections refreshed · 3 preserved (user-edited)" with section names. Banner dismisses on next navigation.
7. Unit tests cover all 4 quadrants of the decision rule (reviewed-edited, reviewed-unedited, draft-edited, draft-unedited).
8. Existing 7 route-handler tests still pass.

## Implementation steps

### Step 1 — Schema migration

The schema is currently bootstrapped via `CREATE TABLE IF NOT EXISTS` in `src/lib/db.ts`. There's no migration system. For one column, the simplest path:

- Add `machineBaseline TEXT` (nullable) to the bootstrap SQL.
- On `db()` first-open, run an idempotent `ALTER TABLE report_sections ADD COLUMN machineBaseline TEXT` wrapped in a try/catch (sqlite throws if the column already exists; that's the signal it's done).
- After ALTER, `UPDATE report_sections SET machineBaseline = content WHERE machineBaseline IS NULL` to backfill.

This is the only schema change. If we add another in the next plan, we promote to a real migration table — flag this as tech debt in the backlog.

**Verify:** Open the app on an existing DB; `sqlite3 data/envdocos.db ".schema report_sections"` shows the new column; existing reports still load.

### Step 2 — Type updates

In `src/lib/types.ts`, add `machineBaseline: string` to `ReportSection`. This is a server-only field — strip it before serializing to the editor JSON, OR include it and ignore in the UI. Pick: **include**. The editor doesn't need to render it but exposing it lets us render the "edited" badge client-side without a second fetch.

### Step 3 — Repo updates

In `src/lib/db.ts`:

- `reportRepo.get` selects `machineBaseline` and includes it in returned sections.
- `reportRepo.upsertForProject` accepts `ReportSection[]` whose elements include `machineBaseline` and persists it.
- New: `reportRepo.regenerate(projectId, freshSections)` — the merge function. Pseudocode:

```ts
function regenerate(projectId, fresh) {
  const existing = get current report's sections by projectId;
  if (!existing) return upsertForProject(projectId, fresh.map(s => ({...s, machineBaseline: s.content})));

  const byId = new Map(existing.map(s => [s.id, s]));
  const refreshed = [], preserved = [];
  const merged = fresh.map(f => {
    const cur = byId.get(f.id);
    if (!cur) { refreshed.push(f.id); return { ...f, machineBaseline: f.content }; }
    const userEdited = cur.content !== cur.machineBaseline;
    const reviewed = cur.status !== 'draft';
    if (userEdited || reviewed) {
      preserved.push(f.id);
      return { ...cur, machineBaseline: f.content };  // bump baseline, keep content+status
    }
    refreshed.push(f.id);
    return { ...f, machineBaseline: f.content };
  });
  upsertForProject(projectId, merged);
  return { refreshed, preserved };
}
```

### Step 4 — Wire into the generate route

`src/app/api/projects/[id]/generate-report/route.ts`:

```ts
const fresh = generateReportSections(project, rows);
const { refreshed, preserved } = reportRepo.regenerate(params.id, fresh);
const report = reportRepo.getByProject(params.id);
return NextResponse.json({ reportId: report.id, refreshed, preserved });
```

(Note: this also implies a small `reportRepo.getByProject` helper — currently the route fetches `existing.id` inline; clean that up while we're here.)

### Step 5 — Preview endpoint

New route: `src/app/api/projects/[id]/generate-report/preview/route.ts`. Same shape, but: don't call `regenerate`; just compute the buckets in a pure function and return them. Extract the bucket-computation into a pure `lib/reportRegenerate.ts` so both the real and preview routes share it.

### Step 6 — Editor UI banner

In `src/app/projects/[id]/UploadCsv.tsx` (where Generate Report fires):

- Before firing the real POST, hit the preview endpoint. If `preserved.length > 0`, show a confirm modal listing preserved section titles: "These sections are protected and will not change: [list]. Refresh the rest?" with **Refresh** / **Cancel**.
- After confirm, fire the real POST.
- Pass `refreshed` / `preserved` into the redirect target via a query param: `/reports/{id}?refreshed=a,b,c&preserved=d,e`.
- In `ReportEditor.tsx`, read the query params and render a dismissable banner. Clear on first interaction.

### Step 7 — Tests

In `src/lib/reportRegenerate.test.ts` (new):

- Quadrant 1 — `draft` + unedited → refreshed.
- Quadrant 2 — `draft` + edited → preserved.
- Quadrant 3 — `reviewed` + unedited → preserved.
- Quadrant 4 — `final` + edited → preserved.
- Edge: section was added in fresh but not in existing → refreshed (added).
- Edge: section was in existing but removed from fresh → not currently reachable (templates are static), but document the behavior: dropped section IDs are kept untouched until templates change. (Out of scope; flag as B-014's concern.)

In route tests:

- `POST /generate-report` with no prior report → all 8 in `refreshed`, none in `preserved`.
- `POST /generate-report` after editing one section → 7 in `refreshed`, 1 in `preserved`.
- `POST /generate-report/preview` does not mutate state (assert `updatedAt` unchanged after the call).

### Step 8 — Update README V1 limits

Remove the bullet "Report regeneration overwrites the report; manual edits are lost." from `README.md`. Replace with a positive note: "Regenerating a report refreshes machine-generated drafts; sections you've reviewed or edited are preserved."

## Test plan

- [ ] `npm test` green, including 4 new quadrant tests
- [ ] Manual: edit Executive Summary text → regenerate → text preserved
- [ ] Manual: mark Conclusion `reviewed`, untouched content → regenerate → status remains `reviewed`, content untouched
- [ ] Manual: edit Trip Generation, then upload a CSV with new intersections → regenerate → Existing Conditions refreshes with new peaks, Trip Generation preserved
- [ ] Banner shows correct counts and section names
- [ ] Preview endpoint returns same buckets as the real call would, without writing

## Risks / open questions

- **Whitespace-only diffs trip the "edited" detector.** A user paste-replace can introduce a trailing newline that compares unequal. Mitigation: normalize whitespace (`.trim().replace(/\r\n/g,'\n')`) on both sides of the comparison. Document this in the comparator.
- **Concurrent regenerate races.** Two clicks, one transaction wins, but the second sees the first's `machineBaseline` and treats the freshly-refreshed content as "user edit." Mitigation: idempotency token on the request, or — pragmatic — disable the button while the request is in flight (already done in `UploadCsv.tsx`). Accept the small race for V1.
- **Migration on a fresh DB.** The `ALTER TABLE` will throw "duplicate column" on second startup. The try/catch handles that, but the catch must check the error message contains `duplicate column name` — don't swallow other errors. Important to get right.
- **Templates change in code.** When we add or rename sections in `generateReportSections`, the by-id match changes. New sections come through as `refreshed` (correct). Removed sections are silently kept. Acceptable for V1; open question for V2.

## File touches

- New: `src/lib/reportRegenerate.ts`, `src/lib/reportRegenerate.test.ts`
- New: `src/app/api/projects/[id]/generate-report/preview/route.ts`
- Edit: `src/lib/db.ts` (column add, `regenerate` helper, `getByProject` helper)
- Edit: `src/lib/types.ts` (`machineBaseline` on `ReportSection`)
- Edit: `src/app/api/projects/[id]/generate-report/route.ts`
- Edit: `src/app/projects/[id]/UploadCsv.tsx` (preview + confirm)
- Edit: `src/app/reports/[id]/ReportEditor.tsx` (banner)
- Edit: `README.md` (V1 limits revision)
