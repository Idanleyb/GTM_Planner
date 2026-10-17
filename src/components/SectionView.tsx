import type { Dispatch } from 'react'
import { SECTIONS, SECTION_BY_ID, checklistFor } from '../config/sections'
import type { CellValue, Project, SectionDef, SectionId } from '../config/types'
import { budgetSummary } from '../engine/budget'
import { computeFunnel, funnelInputsFrom } from '../engine/funnel'
import type { SectionStatus } from '../engine/progress'
import { getRef, motionOf } from '../engine/project'
import { roadmapWarnings } from '../engine/roadmap'
import { archivedChannels, manualRoadmapDates, selectedChannels } from '../engine/wiring'
import { ChannelPicker } from './ChannelPicker'
import { LaunchReviewPanel } from './LaunchReviewPanel'
import { launchReview } from '../engine/launchReview'
import type { PlanView } from '../router'
import type { ProjectAction } from '../state/projectReducer'
import { Checklist } from './Checklist'
import { EditableTable } from './EditableTable'
import { FieldInput } from './FieldInput'
import { BudgetPanel, FunnelPanel, LinkButton, RoadmapWarnings } from './Panels'
import { StatusMark } from './StatusMark'
import { stateLabel } from './labels'

interface Props {
  section: SectionDef
  status: SectionStatus
  project: Project
  dispatch: Dispatch<ProjectAction>
  onNavigate: (id: PlanView) => void
  /** Field edits go through the app so cross-section rules (motion, launch date, funnel model) apply. */
  onField: (section: SectionId, key: string, value: CellValue) => void
  onChannel: (channel: string, on: boolean) => void
  onRecalculateRoadmap: () => void
  today: Date
}

export function SectionView({ section, status, project, dispatch, onNavigate, onField, onChannel, onRecalculateRoadmap, today }: Props) {
  const data = project.data
  const sd = data.sections[section.id]
  const motion = motionOf(data)
  const currency = String(getRef(data, 'brief.currency') || '')
  const idx = SECTIONS.findIndex(s => s.id === section.id)
  const prev = SECTIONS[idx - 1], next = SECTIONS[idx + 1]
  const items = checklistFor(section, motion)
  const warnings = section.id === 'roadmap' ? roadmapWarnings(sd.tables.rows ?? [], today) : []
  const overdueIds = new Set(warnings.filter(w => w.kind === 'overdue').map(w => w.rowId))
  const p = `s-${section.id}`

  return (
    <article aria-labelledby={`${p}-title`} className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="m-0 text-sm font-semibold text-ink-muted">Step {section.number} of {SECTIONS.length}</p>
        <h1 id={`${p}-title`} className="m-0 mt-1 text-3xl font-bold tracking-tight text-ink">{section.title}</h1>
        <p className="mb-0 mt-2 max-w-[68ch] text-ink-soft">{section.intro}</p>
        <GateLine status={status} />
      </header>

      {section.id === 'launch' && <LaunchReviewPanel review={launchReview(data, today)} onNavigate={onNavigate} />}

      {section.readOnlyRefs && (
        <section aria-label="From the GTM brief" className="mb-6 rounded-lg border border-line bg-sheet p-4">
          <dl className="m-0 grid gap-4 sm:grid-cols-2">
            {section.readOnlyRefs.map(ref => {
              const [sid, key] = ref.split('.') as [SectionId, string]
              const f = SECTION_BY_ID[sid].fields?.find(x => x.key === key)
              const val = String(getRef(data, ref))
              return (
                <div key={ref}>
                  <dt className="text-sm font-semibold text-ink">{f?.label}</dt>
                  <dd className="m-0 mt-1 whitespace-pre-line text-sm">{val || <span className="text-ink-muted">Not set yet</span>}</dd>
                </div>
              )
            })}
          </dl>
          <p className="mb-0 mt-3 text-sm text-ink-muted">These come from the brief so every section uses the same wording. <LinkButton onClick={() => onNavigate('brief')}>Edit in GTM brief</LinkButton></p>
        </section>
      )}

      {section.fields && section.fields.length > 0 && (
        <div className="mb-8 grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {section.fields.map(f => {
            const id = `${p}-${f.key}`
            const label = f.type === 'money' && currency ? `${f.label} (${currency})` : f.label
            return (
              <div key={f.key} className={f.full || f.type === 'textarea' && section.fields!.length < 5 ? 'sm:col-span-2' : ''}>
                <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">{label}</label>
                <FieldInput id={id} def={f} value={sd.fields[f.key]} describedBy={f.help ? `${id}-help` : undefined}
                  onChange={v => onField(section.id, f.key, v)} />
                {f.help && <p id={`${id}-help`} className="mb-0 mt-1 text-sm text-ink-muted">{f.help}</p>}
              </div>
            )
          })}
        </div>
      )}

      {section.calculator === 'funnel' && (
        <div className="mb-8"><FunnelPanel result={computeFunnel(funnelInputsFrom(data))} currency={currency} /></div>
      )}
      {section.calculator === 'budget' && (
        <div className="mb-8"><BudgetPanel summary={budgetSummary(data)} currency={currency} onOpenBrief={() => onNavigate('brief')} /></div>
      )}
      {section.id === 'channels' && (
        <ChannelPicker selected={selectedChannels(data)} archived={archivedChannels(data)} onToggle={onChannel} />
      )}
      {section.id === 'roadmap' && <RoadmapDates project={project} onNavigate={onNavigate} onRecalculate={onRecalculateRoadmap} />}
      {warnings.length > 0 && <div className="mb-6"><RoadmapWarnings warnings={warnings} /></div>}

      {section.tables?.map(tb => (
        <section key={tb.key} className="mb-8" aria-labelledby={`${p}-${tb.key}-title`}>
          <h2 id={`${p}-${tb.key}-title`} className="m-0 mb-3 text-lg font-bold text-ink">{tb.title}</h2>
          <EditableTable
            def={tb} rows={sd.tables[tb.key] ?? []} idPrefix={`${p}-${tb.key}`} highlightRowIds={overdueIds}
            onCell={(rowId, key, value) => dispatch({ type: 'setCell', section: section.id, table: tb.key, rowId, key, value })}
            onAdd={() => dispatch({ type: 'addRow', section: section.id, table: tb.key })}
            onDelete={rowId => dispatch({ type: 'deleteRow', section: section.id, table: tb.key, rowId })}
            onMove={(rowId, direction) => dispatch({ type: 'moveRow', section: section.id, table: tb.key, rowId, direction })}
          />
        </section>
      ))}

      {items.length > 0 && (
        <section className="mb-8" aria-labelledby={`${p}-checklist-title`}>
          <h2 id={`${p}-checklist-title`} className="m-0 mb-1 text-lg font-bold text-ink">Checklist</h2>
          <Checklist idPrefix={`${p}-chk`} items={items} hiddenCount={(section.checklist?.length ?? 0) - items.length} motion={motion}
            checks={sd.checks} onToggle={(itemId, checked) => dispatch({ type: 'toggleCheck', section: section.id, itemId, checked })} />
        </section>
      )}

      {section.notices?.map(n => (
        <p key={n} className="mb-4 max-w-[68ch] border-l-2 border-line pl-3 text-sm text-ink-muted">{n}</p>
      ))}

      <nav aria-label="Step navigation" className="mt-10 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
        {prev ? <StepButton onClick={() => onNavigate(prev.id)} dir="prev">{prev.title}</StepButton> : <span />}
        {next && <StepButton onClick={() => onNavigate(next.id)} dir="next">{next.title}</StepButton>}
      </nav>
    </article>
  )
}

function RoadmapDates({ project, onNavigate, onRecalculate }: { project: Project; onNavigate: (id: SectionId) => void; onRecalculate: () => void }) {
  const launch = String(getRef(project.data, 'brief.launchDate'))
  const manual = manualRoadmapDates(project.data)
  if (!launch) {
    return <p className="mb-6 text-sm text-ink-soft">Due dates fill in automatically once the brief has a launch date. <LinkButton onClick={() => onNavigate('brief')}>Set the launch date</LinkButton></p>
  }
  const when = new Date(launch + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <p className="mb-6 text-sm text-ink-soft">
      Due dates follow the launch date ({when}) and move when it changes.
      {manual > 0 && <> {manual} date{manual === 1 ? ' was' : 's were'} set by hand and won’t move. <LinkButton onClick={() => { if (confirm('Reset every due date to launch date + weeks from launch? Dates you set by hand will be replaced.')) onRecalculate() }}>Reset all dates</LinkButton></>}
    </p>
  )
}

function GateLine({ status }: { status: SectionStatus }) {
  if (status.state === 'ready') {
    return (
      <p className="mb-0 mt-4 flex items-center gap-2 rounded-md bg-ready-soft px-3 py-2 text-sm font-semibold text-ready">
        <StatusMark state="ready" /> Ready — everything this step needs is in place.
      </p>
    )
  }
  return (
    <div className="mt-4 rounded-md bg-signal-soft px-3 py-2 text-sm text-ink">
      <p className="m-0 flex items-center gap-2 font-semibold"><StatusMark state={status.state} /> {stateLabel(status.state)}. To mark this step ready:</p>
      <ul className="mb-0 mt-1 list-disc pl-9">{status.missing.map(m => <li key={m}>{m}</li>)}</ul>
    </div>
  )
}

function StepButton({ onClick, dir, children }: { onClick: () => void; dir: 'prev' | 'next'; children: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-md px-4 py-2.5 text-left text-sm ${dir === 'next' ? 'ml-auto bg-ink font-semibold text-white hover:bg-ink-soft' : 'border border-line bg-sheet text-ink hover:border-ink-muted'}`}>
      <span className="block text-xs opacity-75">{dir === 'next' ? 'Next step' : 'Previous step'}</span>
      {children}
    </button>
  )
}
