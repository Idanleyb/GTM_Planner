# GTM Planner

A step-by-step planner that guides marketers through building and running a go-to-market plan: strategy, plan, readiness, and post-launch learning.

Stack: Vite + React + TypeScript, Tailwind, Vitest. Supabase (data + auth) and Vercel (hosting) come next.

## Run it

```bash
npm install
npm run dev        # engine preview at http://localhost:5173
npm test           # unit tests
npm run build      # typecheck + production build
```

## How it is organised

| Path | What lives there |
|---|---|
| `src/config/types.ts` | Types for sections, fields, tables, checklists, gates and stored project data |
| `src/config/sections.ts` | **All plan content as data**: 16 sections in 4 phases, fields, tables, checklists (permanent IDs, motion tags), gates, funnel templates |
| `src/engine/` | Pure logic, no UI: project creation, funnel model, progress and gates, roadmap dates and dependency warnings, budget rollup, unified tasks, prototype import |
| `src/engine/__tests__/` | Vitest suite; the Pimp My Prompt test plan is the fixture |
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
- [ ] Step 3 — Supabase schema + RLS
- [ ] Step 4 — section renderers (fields, editable tables, checklists, calculators)
- [ ] Step 6 — cross-section wiring (channel selection, motion switch, date recalculation)
- [ ] Step 7 — autosave · Step 8 — auth & collaboration · Step 9 — dashboard, Tasks, Go/No-Go views
- [ ] Step 10 — exports (JSON, CSV, DOCX one-pager) · Step 11 — AI assist · Step 12 — e2e tests + Vercel deploy
