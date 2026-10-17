import { SECTIONS } from '../config/sections'
import { PHASES } from '../config/types'
import type { Project, SectionId } from '../config/types'
import type { ProjectProgress } from '../engine/progress'
import { StatusMark } from './StatusMark'
import { launchCountdown } from './labels'

interface Props {
  project: Project
  progress: ProjectProgress
  current: SectionId
  today: Date
  onNavigate: (id: SectionId) => void
  footer: React.ReactNode
}

/** Desktop navigation rail: countdown, progress, and the 16 steps grouped by phase. */
export function Rail({ project, progress, current, today, onNavigate, footer }: Props) {
  const countdown = launchCountdown(String(project.data.sections.brief.fields.launchDate ?? ''), today)
  const statusOf = (id: SectionId) => progress.sections.find(s => s.sectionId === id)!.state
  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col overflow-y-auto bg-ink text-white/85 lg:flex">
      <div className="border-b border-white/10 px-6 pb-5 pt-6">
        <p className="m-0 truncate text-sm text-white/70" title={project.name}>{project.name}</p>
        {countdown ? (
          <p className="m-0 mt-2 flex items-baseline gap-3">
            <span className="condensed text-6xl font-extrabold leading-none tracking-tight text-white tabular-nums">{countdown.value}</span>
            <span className="text-sm text-white/70">{countdown.caption}</span>
          </p>
        ) : (
          <button type="button" onClick={() => onNavigate('brief')} className="mt-3 rounded-md border border-white/25 px-3 py-2 text-sm text-white hover:border-signal">
            Set a launch date
          </button>
        )}
        <div className="mt-4">
          <div className="flex justify-between text-sm"><span>{progress.overall.pct}% complete</span><span className="text-white/60">{progress.sectionsReady.done} of {progress.sectionsReady.total} steps ready</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={progress.overall.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall completion">
            <div className="h-full rounded-full bg-signal" style={{ width: `${progress.overall.pct}%` }} />
          </div>
        </div>
      </div>

      <nav aria-label="Plan steps" className="flex-1 px-3 py-4">
        {PHASES.map(phase => (
          <div key={phase.id} className="mb-4">
            <h2 className="m-0 mb-1 px-3 text-sm font-bold text-white/55">
              {phase.title} <span className="font-normal">{progress.byPhase[phase.id].ready}/{progress.byPhase[phase.id].sections}</span>
            </h2>
            <ul className="m-0 list-none p-0">
              {SECTIONS.filter(s => s.phase === phase.id).map(s => {
                const active = s.id === current
                return (
                  <li key={s.id}>
                    <button
                      type="button" onClick={() => onNavigate(s.id)} aria-current={active ? 'step' : undefined}
                      className={`flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-left text-[0.95rem] ${active ? 'border-signal bg-white/10 font-semibold text-white' : 'border-transparent hover:bg-white/5'}`}
                    >
                      <StatusMark state={statusOf(s.id)} onDark />
                      <span className="w-6 shrink-0 tabular-nums text-white/50">{s.number}</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-6 py-4 text-sm">{footer}</div>
    </aside>
  )
}

/** Compact header for small screens: countdown, progress and a step picker. */
export function MobileBar({ project, progress, current, today, onNavigate, status }: Omit<Props, 'footer'> & { status?: React.ReactNode }) {
  const countdown = launchCountdown(String(project.data.sections.brief.fields.launchDate ?? ''), today)
  return (
    <header className="sticky top-0 z-10 bg-ink px-4 py-3 text-white lg:hidden">
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 truncate text-sm text-white/75">{project.name}</p>
        {countdown && <p className="m-0 shrink-0"><span className="condensed text-2xl font-extrabold">{countdown.value}</span> <span className="text-xs text-white/70">{countdown.caption}</span></p>}
      </div>
      <label htmlFor="mobile-step" className="sr-only">Go to step</label>
      <select id="mobile-step" value={current} onChange={e => onNavigate(e.target.value as SectionId)}
        className="mt-2 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white">
        {PHASES.map(ph => (
          <optgroup key={ph.id} label={ph.title} className="text-ink">
            {SECTIONS.filter(s => s.phase === ph.id).map(s => {
              const st = progress.sections.find(x => x.sectionId === s.id)!.state
              return <option key={s.id} value={s.id}>{s.number} {s.title}{st === 'ready' ? ' — ready' : st === 'in_progress' ? ' — in progress' : ''}</option>
            })}
          </optgroup>
        ))}
      </select>
      <p className="m-0 mt-2 text-xs text-white/70">{progress.overall.pct}% complete, {progress.sectionsReady.done} of {progress.sectionsReady.total} steps ready</p>
      {status && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">{status}</div>}
    </header>
  )
}
