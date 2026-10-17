import { addWeeks, format, isValid, parseISO } from 'date-fns'
import { isDone } from '../config/types'
import type { Row } from '../config/types'
import { toNumber } from './project'

export interface RoadmapWarning { rowId: string; kind: 'dependency' | 'overdue' | 'unknown-dependency'; message: string }

const parseDate = (s: unknown) => {
  if (typeof s !== 'string' || !s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

/**
 * Fill in due dates from the launch date and each row's offset in weeks.
 * Rows with an explicit due date keep it unless `overwrite` is true.
 */
export function materializeDates(launchDate: string, rows: Row[], overwrite = false): Row[] {
  const launch = parseDate(launchDate)
  if (!launch) return rows
  return rows.map(r => {
    const offset = toNumber(r.offsetWeeks)
    if (offset === null || (!overwrite && r.due)) return r
    return { ...r, due: format(addWeeks(launch, offset), 'yyyy-MM-dd') }
  })
}

/** Warn when work starts before its prerequisite is done, or a milestone is past due. */
export function roadmapWarnings(rows: Row[], today: Date = new Date()): RoadmapWarning[] {
  const byName = new Map(rows.map(r => [String(r.workstream ?? '').trim().toLowerCase(), r]))
  const todayKey = format(today, 'yyyy-MM-dd')
  const out: RoadmapWarning[] = []
  for (const r of rows) {
    const dep = String(r.dependsOn ?? '').trim()
    const started = String(r.status ?? 'Not started') !== 'Not started'
    if (dep) {
      const pre = byName.get(dep.toLowerCase())
      if (!pre) out.push({ rowId: r.id, kind: 'unknown-dependency', message: `"${r.workstream}" depends on "${dep}", which is not in the roadmap.` })
      else if (started && !isDone(pre.status)) out.push({ rowId: r.id, kind: 'dependency', message: `"${r.workstream}" is ${String(r.status).toLowerCase()} but "${pre.workstream}" is not complete.` })
    }
    const due = String(r.due ?? '')
    if (due && due < todayKey && !isDone(r.status)) out.push({ rowId: r.id, kind: 'overdue', message: `"${r.workstream}" was due ${due}.` })
  }
  return out
}
