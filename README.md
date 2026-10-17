# GTM Planner

A step-by-step planner that guides marketers through building and running a go-to-market plan: strategy, plan, readiness, and post-launch learning.

Stack: Vite + React + TypeScript, Tailwind, Vitest, Supabase (Postgres + auth, RLS). Vercel hosting comes in Step 12.

First-time Supabase setup: see [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

## Run it

```bash
npm install
cp .env.example .env.local   # add Supabase URL + anon key
npm run dev        # app at http://localhost:5173
npm test           # unit tests + database access-rule tests
npm run build      # typecheck + production build
```

## How it is organised

| Path | What lives there |
|---|---|
| `src/config/types.ts` | Types for sections, fields, tables, checklists, gates and stored project data |
| `src/config/sections.ts` | **All plan content as data**: 16 sections in 4 phases, fields, tables, checklists (permanent IDs, motion tags), gates, funnel templates |
| `src/engine/` | Pure logic, no UI: project creation, funnel model, progress and gates, roadmap dates and dependency warnings, budget rollup, unified tasks, prototype import |
| `src/engine/__tests__/` | Vitest suite; the Pimp My Prompt test plan is the fixture |
| `src/pages/` | Sign-in, plans list, editor, team pages; `src/App.tsx` handles session, workspace and routing (`#/`, `#/team`, `#/p/<id>/<step>`) |
| `src/services/` | Backend interface with a Supabase implementation and an in-memory one (tests, and demo mode when Supabase isn't configured) |
| `src/lib/` | Supabase client, hand-written DB types, project data validation (zod), projects/workspaces data access with conflict-safe saves |
| `supabase/migrations/` | Database schema, triggers and Row Level Security policies |
| `supabase/tests/` | Runs the migration on in-memory Postgres (PGlite) and tests access rules per role |
| `src/test/fixtures/` | Prototype JSON export used as test data |
| `docs/prototype.html` | The original single-file prototype (reference) |

To add or change a step, edit `sections.ts` — the engine and (later) the UI pick it up automatically. Checklist IDs are permanent: never rename or reuse one, because saved checks are keyed by ID.

## Plan structure (v2)

- **Strategy:** GTM brief · Research & validation · ICP & positioning · Pricing & packaging
- **Plan:** Channel strategy · Funnel & KPIs · Budget & resources · Assets & content
- **Readiness:** Analytics & tracking · Team alignment & enablement · Execution roadmap · Risk register · Go / no-go
- **Run & Learn:** Optimization & experiments · Operating cadence · Retro & handover

Key rules:
- The GTM motion (brief) drives the funnel model (B2B pipeline vs PLG / self-serve) and filters checklist items.
- Primary ICP, value proposition and motion live only in the brief; other sections show them read-only.
- A section is **Ready** when its gate passes (required fields, checklist share, or minimum complete rows).
- Roadmap due dates derive from the launch date; dependencies warn when a prerequisite isn't complete.

## Build status

- [x] Step 0 — prototype bug fixes (`docs/prototype.html`)
- [x] Step 1 — content as typed config
- [x] Step 2 — project scaffold
- [x] Step 5 — tested engine + prototype JSON import
- [x] Step 3 — Supabase schema + RLS, data access layer (apply the migration once: see docs/SUPABASE_SETUP.md)
- [x] Step 4 — section screens: fields, editable tables, checklists, funnel + budget calculators, readiness per step (in-memory until Step 7)
- [x] Step 6 — cross-section wiring: channel picker (archive / restore), motion → funnel model, launch date → roadmap dates (hand-set dates kept), project name follows product
- [x] Step 7 — autosave: saves ~1 s after you stop typing, conflict-safe (load theirs / keep mine), retry on network errors, unload warning
- [x] Step 8 — magic-link sign-in, plans list (create, example plan, import/download JSON, rename, archive, delete), team page (invite by email, roles, remove), read-only viewers. Run the second migration: see docs/SUPABASE_SETUP.md
- [ ] Step 9 — dashboard, Tasks, Go/No-Go views
- [ ] Step 10 — exports (JSON, CSV, DOCX one-pager) · Step 11 — AI assist · Step 12 — e2e tests + Vercel deploy
