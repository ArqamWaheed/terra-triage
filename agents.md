# agents.md — Agent Operating Protocol

## Turn Loop
1. **READ** `memory.md`.
2. **LOAD** only docs whose keywords match the task (`research.md`, `PRD.md`, `techdesign-terratriage.md`). Skip the rest.
3. **WORK** — smallest change that advances Next Actions.
4. **UPDATE** `memory.md` (Active Task, Recent Decisions, Open Questions, Next Actions as applicable).
5. **RESPOND** using the Turn Template. ≤ 150 words unless shipping code.

## Roles
| Role | One-liner |
|---|---|
| `scaffolder` | Bootstraps Next.js app, config, tooling, CI. |
| `frontend` | Builds UI (triage form, results, auth screens) in Next.js + Tailwind. |
| `agent-wiring` | Defines + wires Backboard agent contracts and orchestration. |
| `auth` | Integrates Auth0 (login, session, protected routes). |
| `writer` | Drafts DEV post, README, submission copy. |
| `reviewer` | Reads diffs, flags scope creep, verifies `$0` + no-simulation rules. |

## Hand-off Format
When finishing, the outgoing role MUST:
1. Update `memory.md` → `Active Task` = next role's task, `Recent Decisions` += 1 dated line.
2. In the response, state: `Handoff → <role>: <one-line task>`.
3. List any new Open Questions the next role must resolve.

## Turn Template
```
## Turn <n> — <short task>
Context loaded: <files>
Action: <what was done>
Memory updated: <yes/no + sections touched>
Handoff → <role or "none">: <next task>
```

## Anti-patterns (do NOT)
- Re-read all docs every turn.
- Quote `memory.md` verbatim back to the user.
- Skip the memory update step.
- Suggest paid tooling or services.
- Propose simulated/mocked agent behavior as a deliverable.
- Full-file rewrites when a diff suffices.
- Scope creep beyond `PRD.md`.

## Token Budget Guidance
- Soft cap: load `memory.md` + **at most one** long doc per turn.
- Match by keyword:
  - "requirements / scope / user story" → `PRD.md`
  - "architecture / agent / topology / data flow" → `techdesign-terratriage.md`
  - "market / prior art / hackathon rules" → `research.md`
- If none match, work from `memory.md` alone.
- Prefer `grep`/path references over re-reading.
