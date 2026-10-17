import { PHASES, isDone } from '../config/types'
import type { PhaseId, ProjectData, SectionDef } from '../config/types'
import { SECTIONS, checklistFor } from '../config/sections'
import { getRef, isFilled, motionOf } from './project'

export type SectionState = 'not_started' | 'in_progress' | 'ready'

export interface SectionStatus {
  sectionId: SectionDef['id']
  state: SectionState
  /** Human-readable gate items still missing. Empty when ready. */
  missing: string[]
  checks: { done: number; total: number }
  tasks: { done: number; total: number }
}

const INITIAL_STATUSES = ['Not started', 'Planned', 'Open', '']

/** "Business objective", or "GTM brief → Total launch budget" when the field lives in another section. */
function labelForRef(ref: string, current: SectionDef): string {
  const [sid, key] = ref.split('.')
  const sec = SECTIONS.find(s => s.id === sid)
  const field = sec?.fields?.find(f => f.key === key)
  if (!sec || !field) return ref
  return sec.id === current.id ? field.label : `${sec.title} → ${field.label}`
}

export function sectionStatus(section: SectionDef, data: ProjectData): SectionStatus {
  const motion = motionOf(data)
  const sd = data.sections[section.id]
  const items = checklistFor(section, motion)
  const checksDone = items.filter(i => sd.checks[i.id]).length

  let tasksDone = 0, tasksTotal = 0
  for (const tb of section.tables ?? []) {
    if (!tb.task) continue
    for (const r of sd.tables[tb.key] ?? []) { tasksTotal++; if (isDone(r[tb.task.statusKey])) tasksDone++ }
  }

  const missing: string[] = []
  const g = section.gate
  for (const ref of g.fields ?? []) if (!isFilled(getRef(data, ref))) missing.push(labelForRef(ref, section))
  if (g.checklistMin !== undefined && items.length) {
    const need = Math.ceil(items.length * g.checklistMin)
    if (checksDone < need) missing.push(`Checklist: ${checksDone}/${need} required items checked`)
  }
  if (g.tableRows) {
    const { table, min, requireCols } = g.tableRows
    const complete = (sd.tables[table] ?? []).filter(r => requireCols.every(c => isFilled(r[c]))).length
    if (complete < min) {
      const title = section.tables?.find(t => t.key === table)?.title ?? table
      missing.push(`${title}: ${complete}/${min} rows with ${requireCols.join(', ')}`)
    }
  }

  const touched =
    // a field counts as touched only when it differs from its default
    (section.fields ?? []).some(f => f.type !== 'select' && isFilled(sd.fields[f.key]) && sd.fields[f.key] !== (f.default ?? '')) ||
    checksDone > 0 ||
    (section.tables ?? []).some(tb => tb.task && (sd.tables[tb.key] ?? []).some(r => !INITIAL_STATUSES.includes(String(r[tb.task!.statusKey] ?? ''))))

  const state: SectionState = missing.length === 0 ? 'ready' : touched ? 'in_progress' : 'not_started'
  return { sectionId: section.id, state, missing, checks: { done: checksDone, total: items.length }, tasks: { done: tasksDone, total: tasksTotal } }
}

export interface Progress { done: number; total: number; pct: number }
const pct = (done: number, total: number): Progress => ({ done, total, pct: total ? Math.round(done / total * 100) : 0 })

/** Completion = applicable checklist items checked + work-item rows done, across the given sections. */
export function progressOf(statuses: SectionStatus[]): Progress {
  const done = statuses.reduce((a, s) => a + s.checks.done + s.tasks.done, 0)
  const total = statuses.reduce((a, s) => a + s.checks.total + s.tasks.total, 0)
  return pct(done, total)
}

export interface ProjectProgress {
  overall: Progress
  sectionsReady: { done: number; total: number }
  byPhase: Record<PhaseId, Progress & { ready: number; sections: number }>
  sections: SectionStatus[]
}

export function projectProgress(data: ProjectData): ProjectProgress {
  const sections = SECTIONS.map(s => sectionStatus(s, data))
  const byPhase = Object.fromEntries(PHASES.map(p => {
    const inPhase = sections.filter(s => SECTIONS.find(d => d.id === s.sectionId)!.phase === p.id)
    return [p.id, { ...progressOf(inPhase), ready: inPhase.filter(s => s.state === 'ready').length, sections: inPhase.length }]
  })) as ProjectProgress['byPhase']
  return {
    overall: progressOf(sections),
    sectionsReady: { done: sections.filter(s => s.state === 'ready').length, total: sections.length },
    byPhase,
    sections,
  }
}
