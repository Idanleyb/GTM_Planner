// Temporary engine preview (Steps 1, 2 and 5). The real section UI comes in Step 4.
// Shows the config-driven phases/sections with gate status, computed from the
// Pimp My Prompt test plan migrated from the prototype.
import { useEffect, useMemo, useState } from 'react'
import fixture from './test/fixtures/prototype-pimp-my-prompt.json'
import { PHASES } from './config/types'
import { SECTIONS } from './config/sections'
import { supabase } from './lib/supabase'
import { checkConnection } from './lib/connectionCheck'
import type { ConnectionState } from './lib/connectionCheck'
import { budgetSummary, computeFunnel, createProjectData, funnelInputsFrom, migratePrototype, projectProgress } from './engine'

const STATE_STYLE = {
  ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  not_started: 'bg-slate-50 text-slate-500 border-slate-200',
} as const
const STATE_LABEL = { ready: 'Ready', in_progress: 'In progress', not_started: 'Not started' } as const

export default function App() {
  const [source, setSource] = useState<'fixture' | 'empty'>('fixture')
  const [conn, setConn] = useState<ConnectionState | null>(null)
  useEffect(() => { checkConnection(supabase).then(setConn) }, [])
  const { data, warnings } = useMemo(() => {
    if (source === 'empty') return { data: createProjectData('Hybrid'), warnings: [] as string[] }
    const m = migratePrototype(fixture)
    return { data: m.project.data, warnings: m.warnings }
  }, [source])
  const progress = projectProgress(data)
  const funnel = computeFunnel(funnelInputsFrom(data))
  const budget = budgetSummary(data)
  const cur = String(data.sections.brief.fields.currency || '')

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8 font-sans text-slate-800">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">GTM Planner · engine preview</p>
          <h1 className="text-2xl font-bold">{String(data.sections.brief.fields.product || 'Empty project')}</h1>
        </div>
        <select className="rounded-lg border px-3 py-2" value={source} onChange={e => setSource(e.target.value as 'fixture' | 'empty')}>
          <option value="fixture">Test plan (migrated prototype)</option>
          <option value="empty">Empty project</option>
        </select>
      </header>

      <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${conn?.state === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
        <b>Supabase:</b> {conn === null ? 'checking…' : conn.state === 'not-configured' ? 'not configured (add .env.local)' : conn.detail}
      </p>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Completion" value={`${progress.overall.pct}%`} />
        <Stat label="Sections ready" value={`${progress.sectionsReady.done}/${progress.sectionsReady.total}`} />
        <Stat label="First-stage spend" value={funnel.valid ? `${cur} ${Math.round(funnel.firstStageSpend).toLocaleString()}` : '—'} />
        <Stat label="Budget vs brief" value={budget.status.replace(/-/g, ' ')} />
      </section>

      {warnings.length > 0 && (
        <div className="mb-6 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
          <b>Migration notes</b>
          <ul className="ml-5 list-disc">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {PHASES.map(phase => (
        <section key={phase.id} className="mb-6">
          <h2 className="text-lg font-bold">{phase.title} <span className="text-sm font-normal text-slate-500">· {progress.byPhase[phase.id].ready}/{progress.byPhase[phase.id].sections} ready</span></h2>
          <p className="mb-2 text-sm text-slate-500">{phase.intro}</p>
          <div className="grid gap-2">
            {SECTIONS.filter(s => s.phase === phase.id).map(s => {
              const st = progress.sections.find(x => x.sectionId === s.id)!
              return (
                <div key={s.id} className="rounded-xl border bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{s.number} · {s.title}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {st.checks.total > 0 && <span>checks {st.checks.done}/{st.checks.total}</span>}
                      {st.tasks.total > 0 && <span>tasks {st.tasks.done}/{st.tasks.total}</span>}
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${STATE_STYLE[st.state]}`}>{STATE_LABEL[st.state]}</span>
                    </span>
                  </div>
                  {st.missing.length > 0 && <p className="mt-1 text-xs text-slate-500">Missing: {st.missing.join(' · ')}</p>}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <span className="block text-xs text-slate-500">{label}</span>
      <strong className="text-lg capitalize">{value}</strong>
    </div>
  )
}
