# UI Design

## Screen 1: Create Project
Fields:
- Project name
- Location
- Jurisdiction
- Client
- Project type
- Development summary
- Prepared by

CTA:
- Create Project

## Screen 2: Upload Traffic Data
Elements:
- CSV upload box
- Required CSV format preview
- Import validation table
- Imported intersections summary

CTA:
- Generate Report

## Screen 3: Report Editor
Layout:
- Left sidebar: report sections
- Main panel: editable section content
- Right panel: metrics + warnings

Sections:
- Executive Summary
- Project Description
- Study Area
- Existing Conditions
- Trip Generation
- Impact Analysis
- Mitigation / Recommendations
- Conclusion

CTA:
- Export DOCX

## Screen 4: Export
Elements:
- Export format selector
- DOCX primary
- PDF future
- Download button

---

## Addenda — screens shipped after V1 (current as of 2026-05-01)

| Screen                       | Path                       | Notes                                                                                                                                  |
| ---------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in / Sign up            | `/signin`, `/signup`       | Auth.js v5 Credentials. Signup sends a verification email; first signup claims any orphan projects.                                    |
| Forgot / Reset password      | `/forgot-password`, `/reset-password?token=…` | Single-use 1h token; verification banner on the account page.                                          |
| Account                      | `/account`                 | Profile, email-verification status, change-email form, change-password form, danger-zone delete.                                       |
| Project list (`Screen 0`)    | `/`                        | Search + sort dropdown; "Shared" badge for projects accessed via a share.                                                              |
| Project detail               | `/projects/[id]`           | CSV upload + diff preview, manual row CRUD, manual inputs form, owner-only Shares panel, owner-only Activity panel.                    |
| Edit project                 | `/projects/[id]/edit`      | All editable fields. Cancel returns to detail.                                                                                         |
| Report editor                | `/reports/[id]`            | 3-pane layout from V1; drag-to-reorder sections, custom-section CRUD, per-section regenerate with confirm, refreshed/preserved banner. |

### Sharing UX

The Shares panel is owner-only. Each row shows the sharee's email and a role select (`reader` / `editor`); changing the select PATCHes `/api/projects/:id/shares/:userId`. The invite form takes an email + role and is idempotent — re-inviting an existing sharee updates their role rather than 409-ing.

### Read-only mode

When a reader-role sharee views `/reports/[id]`, the editor strips Save / Regenerate / Add custom section / drag-handles, swaps the textarea for a read-only display, and renders status as plain text instead of a select. PDF and DOCX export remain available.

### Audit panel

Owner-only Activity feed at the bottom of `/projects/[id]`. Most-recent-first list of `{when, who, action}`. Hidden entirely (the API returns 403) for sharees.
