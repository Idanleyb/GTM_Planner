import { format } from 'date-fns'
import { SECTIONS } from '../config/sections'
import { isDone } from '../config/types'
import type { ProjectData, SectionId, TaskMapping } from '../config/types'

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
  /** Which row columns hold the title, owner, due date and status (for inline editing). */
  mapping: TaskMapping
  /** Allowed status values for this kind of task. */
  statusOptions: readonly string[]
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
          mapping: m, statusOptions: tb.columns.find(c => c.key === m.statusKey)?.options ?? [],
          sectionId: s.id, sectionTitle: s.title, tableKey: tb.key, rowId: r.id,
          title: String(r[m.titleKey] ?? ''), owner: String(r[m.ownerKey] ?? ''), due,
          status: String(r[m.statusKey] ?? ''), done, overdue: !!due && due < todayKey && !done,
        })
      }
    }
  }
  return out
}


// ---------------------------------------------------------------- filtering

export type TaskStatusFilter = 'open' | 'overdue' | 'week' | 'unassigned' | 'done' | 'all'
export interface TaskFilter {
  status: TaskStatusFilter
  /** '' = anyone */
  owner: string
  /** '' = every step */
  section: SectionId | ''
  q: string
}
export const DEFAULT_TASK_FILTER: TaskFilter = { status: 'open', owner: '', section: '', q: '' }

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')
const weekAhead = (today: Date) => dayKey(new Date(today.getTime() + 7 * 86400000))

export function matchesStatus(t: TaskItem, status: TaskStatusFilter, today: Date): boolean {
  switch (status) {
    case 'open': return !t.done
    case 'overdue': return t.overdue
    case 'week': return !t.done && !!t.due && t.due >= dayKey(today) && t.due <= weekAhead(today)
    case 'unassigned': return !t.done && !t.owner.trim()
    case 'done': return t.done
    case 'all': return true
  }
}

/** Filter, then sort: overdue first, then by due date (no date last), then by plan order. */
export function filterTasks(tasks: TaskItem[], f: TaskFilter, today: Date = new Date()): TaskItem[] {
  const q = f.q.trim().toLowerCase()
  const order = new Map(SECTIONS.map((s, i) => [s.id, i]))
  return tasks
    .map((t, i) => ({ t, i }))
    .filter(({ t }) =>
      matchesStatus(t, f.status, today) &&
      (!f.owner || t.owner.trim().toLowerCase() === f.owner.toLowerCase()) &&
      (!f.section || t.sectionId === f.section) &&
      (!q || `${t.title} ${t.owner} ${t.sectionTitle} ${t.status}`.toLowerCase().includes(q)))
    .sort((a, b) =>
      Number(b.t.overdue) - Number(a.t.overdue) ||
      (a.t.due || '9999').localeCompare(b.t.due || '9999') ||
      (order.get(a.t.sectionId)! - order.get(b.t.sectionId)!) || a.i - b.i)
    .map(({ t }) => t)
}

export interface TaskCounts { open: number; overdue: number; week: number; unassigned: number; done: number; all: number }
export function taskCounts(tasks: TaskItem[], today: Date = new Date()): TaskCounts {
  const c = (s: TaskStatusFilter) => tasks.filter(t => matchesStatus(t, s, today)).length
  return { open: c('open'), overdue: c('overdue'), week: c('week'), unassigned: c('unassigned'), done: c('done'), all: tasks.length }
}

/** Distinct owners as typed (case-insensitive), sorted. */
export function taskOwners(tasks: TaskItem[]): string[] {
  const seen = new Map<string, string>()
  for (const t of tasks) { const o = t.owner.trim(); if (o && !seen.has(o.toLowerCase())) seen.set(o.toLowerCase(), o) }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function tasksCsv(tasks: TaskItem[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const rows = [['Task', 'Step', 'Owner', 'Due', 'Status', 'Overdue'], ...tasks.map(t => [t.title, t.sectionTitle, t.owner, t.due, t.status, t.overdue ? 'yes' : ''])]
  return rows.map(r => r.map(cell).join(',')).join('\r\n')
}
