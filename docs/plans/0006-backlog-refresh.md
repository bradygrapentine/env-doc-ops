# Plan 0006 — Backlog refresh + parallel batch

Date: 2026-05-01
Status: Proposed (rev 2)

## Goal

Refresh `docs/backlog.md` with refined stories drawn from spec gaps and latent tech debt, then ship them in a sequenced wave: one serial story (auditRepo edit), then four parallel tracks.

## Section A — New Ready stories (refine into backlog)

### B-055 — Audit-log pagination

- `GET /api/projects/:id/audit` accepts `?limit` (default 50, max 200) + `?before=<createdAt ISO>` cursor.
- `auditRepo.list(projectId, {limit, before})`; existing call sites pass defaults.
- `AuditPanel.tsx` gets a "Load more" button that re-fetches with the oldest visible row's `createdAt` as `before`.
- Files: `src/lib/db.ts` (auditRepo.list signature), `src/app/api/projects/[id]/audit/route.ts`, `src/components/AuditPanel.tsx`, tests.
- **Out of scope:** retention/prune helper. Add as a separate story when a cron exists.
- Effort: S. Priority: P2.

### B-056 — Rate-limit signin / signup / forgot-password

- **Spike (15 min, gate the rest of the story):** verify how to read client IP inside Auth.js v5 Credentials `authorize()` callback. If `req` isn't accessible, fall back to rate-limiting at a wrapper Route Handler that pre-validates before delegating to Auth.js, OR rate-limit by submitted email instead of IP. Document the choice in the PR.
- Reuse current in-memory `rate-limit-policy.ts`. Multi-process concern is already tracked under B-053 — not a blocker for this story.
- New helper `gateUnauthenticatedEndpoint(key, action, bucket)` mirroring `gatePasswordEndpoint` but accepting an arbitrary key (IP or email).
- Limits: 10 / 15min for signin + forgot-password; 3 / hour for signup.
- 429 with `Retry-After`. Existing logic unchanged on success.
- Files: `src/lib/rate-limit-policy.ts`, `src/app/api/auth/signup/route.ts`, signin path (depends on spike), `src/app/api/auth/forgot-password/route.ts`, tests.
- Effort: S. Priority: P1.

### B-057 — CSV upload row + byte cap

- **Spike (15 min):** verify the right body-size mechanism on Next.js 14 App Router. Options to evaluate: route segment config, manual `request.headers.get("content-length")` check, or `Request.body` stream cap. Pick one and document.
- Hard caps: 1 MiB request body, 5000 rows post-parse.
- Reject with 413 (body) or 422 (row count) and a clear error message; UI surfaces it in `UploadCsv` and the preview route.
- Files: `src/lib/csv.ts`, both `traffic-data` routes, `src/components/UploadCsv.tsx`, tests.
- Effort: S. Priority: P1.

### B-058 — Email-change notification to old address

- When `change-email` succeeds in issuing a token, also send a "we got a request to change your email — if this wasn't you, secure your account" email to the **current** address.
- Notification to old address must NOT contain the new address in plaintext (avoid leaking destination if the old account is compromised). Link points at `/account` (or password-reset flow), not the confirm-email-change page.
- Test assertions: (a) two emails captured; (b) one to old address, one to new; (c) old-address email body contains a password-reset / "wasn't me" CTA but does NOT contain the new email string.
- Files: `src/app/api/auth/change-email/route.ts`, `src/lib/email.ts` (new template fn), tests.
- Effort: S. Priority: P1.

## Section B — Execution wave

Sequenced: **T1 first (touches `src/lib/db.ts`)**, then T2/T3/T4/T5 dispatched in parallel against the post-T1 main.

### Order

| Step         | Track | Story     | Owned files                                                                                                                                                             |
| ------------ | ----- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (serial)   | T1    | **B-054** | `src/lib/db.ts` (auditRepo.scrubUser only), `src/app/api/auth/confirm-email-change/route.ts`, `src/lib/db.ts` (tokenRepo.peekEmailChange)                               |
| 2 (parallel) | T2    | **B-055** | `src/lib/db.ts` (auditRepo.list new signature — touches the file again, but rebases on T1), `src/app/api/projects/[id]/audit/route.ts`, `src/components/AuditPanel.tsx` |
| 2 (parallel) | T3    | **B-056** | `src/lib/rate-limit-policy.ts`, `src/app/api/auth/signup/route.ts`, signin/authorize path, `src/app/api/auth/forgot-password/route.ts`                                  |
| 2 (parallel) | T4    | **B-057** | `src/lib/csv.ts`, `src/app/api/projects/[id]/traffic-data/route.ts`, `src/app/api/projects/[id]/traffic-data/preview/route.ts`, `src/components/UploadCsv.tsx`          |
| 2 (parallel) | T5    | **B-058** | `src/app/api/auth/change-email/route.ts`, `src/lib/email.ts`                                                                                                            |

Step-2 conflict map:

- T2 and T3 both need `src/lib/db.ts` only if T3 grows; current scope keeps T3 out of `db.ts`. Verified.
- T2 is the only step-2 track touching `db.ts` after T1 lands → safe.
- T4, T5 are isolated.

### PR strategy

Five separate PRs (one per track), matching the B-051/B-052 precedent. Each PR: tests-first, full local `npm run check` green before `gh pr ready`, heartbeat to `.claude/agent-status/<id>.log`.

### Excluded / explicit deferrals

- **B-053 (Redis-backed limiter)** — reclassify to **Blocked** in `docs/backlog.md`: pending a hosting decision (Upstash vs self-hosted vs Vercel KV). Write a tiny ADR (`docs/adr/0001-rate-limit-shared-store.md`) capturing the choice before implementing.

## Section C — Deferred / needs PRD before refining

| Tag | Working title                             | Why deferred                                             |
| --- | ----------------------------------------- | -------------------------------------------------------- |
| R-1 | Multi-CSV / re-import counts              | UX decision (replace vs append vs version) — needs PRD   |
| R-2 | Report versions / snapshot pre-regenerate | schema change + storage policy — needs ADR               |
| R-3 | Project clone / template                  | revisit after R-1                                        |
| R-8 | Sentry + PostHog wiring                   | external accounts + envvars; pair with `/harden-project` |

## Section D — Tech-debt log (append to backlog §2)

- Coverage exclusions revisit: `auth.ts`, `auth.config.ts`, `middleware.ts`, `email.ts` (real-send integration test).
- `console.error` scattered; no structured logger.
- `audit_log` retention/prune policy — separate story when a cron host exists.

## Section E — Phase gates (per `/sdlc`)

1. Backlog edit: add B-055/056/057/058 to §1 Ready; mark B-053 Blocked; bump status board (Ready 2 → 5, Blocked 0 → 1); append Section D items to §2.
2. `dispatch-preflight` skill — verify `origin/main == main`, capture base SHA.
3. **T1 dispatch** (B-054) → merge → integration check (`npm run check`).
4. **T2–T5 parallel dispatch** off post-T1 main.
5. **Phase 7 Verify** — `npm run check` + Playwright on each PR.
6. **Phase 8 Code review** — `pr-review-toolkit:review-pr` on each PR.
7. **Phase 9 Security review** — `/security-review` REQUIRED; B-056 (auth surface), B-057 (DoS surface), B-058 (account-takeover surface) all qualify.
8. **Phase 10 Adversarial gate** — `codex-adversarial-gate` on the merged batch.
9. Phase 11 Perf — skipped (no UI hot path; AuditPanel "Load more" is below-the-fold).
10. **Phase 12 Merge** — five separate PRs via `merge-pr`.
11. **Phase 15 Backlog-sync** — promote shipped rows to §3.

## Coverage / regression posture

- All four new stories add code in already-thresholded directories (`src/lib/**`, `src/app/api/**`). Tests-first → thresholds hold by construction.
- E2E: B-057 adds an error-path Playwright assertion for the 413 message. Other tracks have no UI flow change.

## Out of scope

No schema migrations beyond auditRepo helper signatures. No new external services. No UI redesigns. No retention/prune for audit log.
