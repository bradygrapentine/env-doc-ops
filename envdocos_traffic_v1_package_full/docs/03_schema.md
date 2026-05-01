# Data Schema

## Project

```ts
type Project = {
  id: string;
  name: string;
  location: string;
  jurisdiction: string;
  clientName?: string;
  projectType: string;
  developmentSummary: string;
  preparedBy?: string;
  createdAt: string;
};
```

## Traffic Count Row

```ts
type TrafficCountRow = {
  id: string;
  projectId: string;
  intersection: string;
  period: "AM" | "PM" | "MIDDAY" | "OTHER";
  approach?: string;
  inbound: number;
  outbound: number;
  total: number;
};
```

## Report

```ts
type Report = {
  id: string;
  projectId: string;
  sections: ReportSection[];
  createdAt: string;
  updatedAt: string;
};
```

## Report Section

```ts
type ReportSection = {
  id: string;
  title: string;
  order: number;
  content: string;
  status: "draft" | "reviewed" | "final";
};
```

## Derived Metrics

```ts
type TrafficMetrics = {
  intersections: string[];
  highestAmIntersection?: string;
  highestAmTotal?: number;
  highestPmIntersection?: string;
  highestPmTotal?: number;
  totalAmVolume: number;
  totalPmVolume: number;
};
```

---

## Addenda — additions shipped after V1 (current as of 2026-05-01)

The shapes above are the original V1 spec. The live schema is in `src/lib/types.ts` and `src/lib/db.ts`. Concrete additions in the shipped product:

- **User** — `id, email, name, createdAt, emailVerifiedAt?` + `passwordHash` (bcrypt) on the row but not the public type.
- **Project** — gained `userId: string | null` (nullable to support the pre-auth seed flow that adopts orphans on first signup) and `manualInputs?: ManualInputs` (`{ growthRate?, tripGenAssumptions?, mitigationNotes?, engineerConclusions? }`).
- **ReportSection** — gained `machineBaseline: string` (last machine-generated body, used by the regenerate-without-losing-edits planner) and `kind: 'standard' | 'custom'`.
- **ShareRole** — `'reader' | 'editor'`. `ProjectAccessRole` adds `'owner'` for the implicit owner case.
- **Tokens** — three single-use, time-bounded tables: `verification_tokens`, `password_reset_tokens`, `email_change_tokens`.
- **Audit** — `audit_log(id, projectId, userId, action, details, createdAt)` with `AuditAction` covering the project / report / section / share mutation surface.

Nothing in the original V1 schema was removed; the current code is a strict superset.
