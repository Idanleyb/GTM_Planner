import { format } from 'date-fns'
import { SECTIONS } from '../config/sections'
import { isDone } from '../config/types'
import type { ProjectData, SectionId } from '../config/types'

export interface TaskItem {
  sectionId: SectionId
  sectionTitle: string
  tableKey: string
  rowId: string
  title: string
  owner: string
  due: string
  status: string
  done: boolean
  overdue: boolean
}

/** Every work-item row across the plan, for the unified Tasks view. */
export function collectTasks(data: ProjectData, today: Date = new Date()): TaskItem[] {
  const todayKey = format(today, 'yyyy-MM-dd')
  const out: TaskItem[] = []
  for (const s of SECTIONS) {
    for (const tb of s.tables ?? []) {
      if (!tb.task) continue
      const m = tb.task
      for (const r of data.sections[s.id].tables[tb.key] ?? []) {
        const due = m.dueKey ? String(r[m.dueKey] ?? '') : ''
        const done = isDone(r[m.statusKey])
        out.push({
          sectionId: s.id, sectionTitle: s.title, tableKey: tb.key, rowId: r.id,
          title: String(r[m.titleKey] ?? ''), owner: String(r[m.ownerKey] ?? ''), due,
          status: String(r[m.statusKey] ?? ''), done, overdue: !!due && due < todayKey && !done,
        })
      }
    }
  }
  return out
}
