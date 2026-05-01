# API Spec

## POST /api/projects
Create project.

Request:
```json
{
  "name": "West Loop Mixed Use",
  "location": "123 Main St, Chicago, IL",
  "jurisdiction": "Chicago",
  "projectType": "Mixed-use development",
  "developmentSummary": "120 residential units and 15,000 square feet of retail"
}
```

## POST /api/projects/:id/traffic-data
Upload CSV traffic count data.

Response:
```json
{
  "rowsImported": 48,
  "intersections": ["Main St & 1st Ave"]
}
```

## POST /api/projects/:id/generate-report
Generate structured draft report.

Response:
```json
{
  "reportId": "report_123",
  "sections": []
}
```

## GET /api/reports/:id
Fetch report.

## PATCH /api/reports/:id/sections/:sectionId
Update section content.

## POST /api/reports/:id/export-docx
Generate DOCX export.

---

## Addenda — endpoints shipped after V1 (current as of 2026-05-01)

These were added to round out the product. Full request/response shapes live with each route in `src/app/api/**/route.ts`; this list is a map.

### Auth

| Method | Path                                  | Summary                                                                                |
| ------ | ------------------------------------- | -------------------------------------------------------------------------------------- |
| POST   | `/api/auth/signup`                    | Create user; first signup adopts orphan projects; sends a verification email.          |
| POST   | `/api/auth/forgot-password`           | Always 200 (no existence leak); emails reset link if the user exists.                  |
| POST   | `/api/auth/reset-password`            | Single-use token + new password (≥8).                                                  |
| GET    | `/api/auth/verify-email?token=…`      | Marks email verified; redirects to `/account?verified=…`.                              |
| POST   | `/api/auth/send-verification`         | Re-issue verification email for the signed-in user.                                    |
| POST   | `/api/auth/change-password`           | Verify current password; rotate to new (≥8).                                           |
| POST   | `/api/auth/change-email`              | Verify current password; sends confirmation link to the new address.                   |
| GET    | `/api/auth/confirm-email-change?token=…` | Consume token + rotate email; redirects to `/account?email_change=…`.               |
| DELETE | `/api/auth/account`                   | Verify current password; FK cascade-delete the user.                                   |
| GET/POST | `/api/auth/[...nextauth]`           | Auth.js v5 trampoline (Credentials provider).                                          |

### Projects (build-out beyond create-only)

| Method | Path                                              | Summary                                            |
| ------ | ------------------------------------------------- | -------------------------------------------------- |
| GET    | `/api/projects`                                   | List projects accessible to the user (owner + shared). |
| GET    | `/api/projects/:id`                               | Project detail (owner or sharee).                  |
| PATCH  | `/api/projects/:id`                               | Editable fields + `manualInputs`. Editor or owner. |
| DELETE | `/api/projects/:id`                               | Owner-only.                                        |
| POST   | `/api/projects/:id/traffic-data/preview`          | Per-row diff preview before import.                |
| GET/POST/PATCH/DELETE | `/api/projects/:id/traffic-data/rows[/:rowId]` | Manual row CRUD.                  |
| POST   | `/api/projects/:id/generate-report/preview`       | Preview which sections would refresh vs. preserve. |
| GET    | `/api/projects/:id/audit`                         | Owner-only activity feed.                          |
| GET/POST | `/api/projects/:id/shares`                      | Owner-only share list / invite.                    |
| PATCH/DELETE | `/api/projects/:id/shares/:userId`          | Owner-only role change / removal.                  |

### Reports

| Method | Path                                                       | Summary                                          |
| ------ | ---------------------------------------------------------- | ------------------------------------------------ |
| POST   | `/api/reports/:id/sections`                                | Add a custom section.                            |
| DELETE | `/api/reports/:id/sections/:sectionId`                     | Remove a custom section (refuses standard).      |
| PATCH  | `/api/reports/:id/sections/order`                          | Reorder sections.                                |
| POST   | `/api/reports/:id/sections/:sectionId/regenerate`          | Regenerate one section from current data.        |
| POST   | `/api/reports/:id/export-pdf`                              | PDF export, mirrors DOCX.                        |

### Access semantics

- `read` mode: owner + any sharee.
- `write` mode: owner + editor sharees. Reader sharees get 403 with `{ error: "Read-only access" }`.
- Share management and project deletion are owner-only regardless of write access.
