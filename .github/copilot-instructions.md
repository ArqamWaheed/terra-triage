# Copilot Instructions — Terra Triage

Solo-dev hackathon repo. Optimize for **tokens, speed, and shipping**.

## Read Order (every turn)
1. `memory.md` — always.
2. Only if task keywords match: `research.md`, `PRD.md`, `techdesign-terratriage.md`.
3. `agents.md` — when delegating or assuming a role.
4. Then the task.

Do **not** read docs that don't match the current task's keywords.

## Context Compression Rules
- Reference files by path; **do not quote** their contents back.
- Never restate `memory.md` content to the user — they wrote it.
- Prefer **diffs and surgical edits** over full-file rewrites.
- Responses ≤ **150 words** unless delivering code.
- No filler ("Certainly!", "Great question!", recaps of the request).

## Commands
- `/compress` → immediately rewrite `memory.md` collapsing stale entries per its Compression Protocol. Confirm in ≤ 2 lines. Do nothing else that turn.
- `/sync` → re-read `memory.md` plus the single doc relevant to the current task. Reply with a 1-line status.

## Conventions
- **Filenames**: kebab-case (`triage-form.tsx`, not `TriageForm.tsx` for non-components; components keep PascalCase file names only when framework requires).
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/). Always append:
  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```
- **Branching**: trunk-based; short-lived branches only if needed.

## Non-negotiables
- **Always update `memory.md` at end of turn.** Sections touched must be listed in the response.
- **$0 cost constraint** — never suggest paid services/APIs/hosting. Free tiers only (Vercel/Netlify hobby, Auth0 free, Backboard hackathon credits, etc.).
- **No simulations / no mocked demos** — ship real agent calls, real auth, real data flow.

## Hackathon Context
- Deadline: **2026-04-20 06:59 UTC**.
- Prize targets: **Backboard (primary)**, **Auth0 (secondary)**.
- Do-not-do: simulated agents, fake auth, placeholder data passed off as real, scope creep beyond PRD.
