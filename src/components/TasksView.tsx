import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import type { Dispatch } from 'react'
import { SECTIONS } from '../config/sections'
import type { Project, SectionId } from '../config/types'
import { DEFAULT_TASK_FILTER, collectTasks, filterTasks, taskCounts, taskOwners, tasksCsv } from '../engine/tasks'
import type { TaskFilter, TaskStatusFilter } from '../engine/tasks'
import type { ProjectAction } from '../state/projectReducer'
import { FieldInput } from './FieldInput'
import { LinkButton } from './Panels'
import { useReadOnly } from './ReadOnly'

const STATUS_TABS: { id: TaskStatusFilter; label: string }[] = [
  { id: 'open', label: 'Open' }, { id: 'overdue', label: 'Overdue' }, { id: 'week', label: 'Due in 7 days' },
  { id: 'unassigned', label: 'No owner' }, { id: 'done', label: 'Done' }, { id: 'all', label: 'All' },
]

interface Props { project: Project; dispatch: Dispatch<ProjectAction>; today: Date; onNavigate: (id: SectionId) => void }

/** Every row with an owner, due date and status across the plan, in one list. */
export function TasksView({ project, dispatch, today, onNavigate }: Props) {
  const [filter, setFilter] = useState<TaskFilter>(DEFAULT_TASK_FILTER)
  const readOnly = useReadOnly()
  const all = collectTasks(project.data, today)
  const counts = taskCounts(all, today)
  const owners = taskOwners(all)
  const shown = filterTasks(all, filter, today)
  const stepsWithTasks = SECTIONS.filter(s => all.some(t => t.sectionId === s.id))
  const set = (patch: Partial<TaskFilter>) => setFilter(f => ({ ...f, ...patch }))
  const filtered = filter.owner || filter.section || filter.q || filter.status !== 'open'

  const exportCsv = () => {
    const blob = new Blob(['﻿' + tasksCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasks - ${project.name.replace(/[\\/:*?"<>|]+/g, '')}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <article aria-labelledby="tasks-title" className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 text-sm font-semibold text-ink-muted">Across all 16 steps</p>
          <h1 id="tasks-title" className="m-0 mt-1 text-3xl font-bold tracking-tight text-ink">Tasks</h1>
          <p className="mb-0 mt-2 max-w-[68ch] text-ink-soft">Channels, assets, calendar items, team deliverables, milestones and risks in one list. Changes here update the step they belong to.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!shown.length} className="rounded-md border border-line bg-sheet px-4 py-2.5 font-semibold text-ink hover:border-ink-muted disabled:opacity-50">
          Export {shown.length} to CSV
        </button>
      </header>

      <fieldset className="m-0 mb-4 border-0 p-0">
        <legend className="sr-only">Show</legend>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map(t => {
            const on = filter.status === t.id
            const n = counts[t.id]
            const alert = t.id === 'overdue' && n > 0
            return (
              <label key={t.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${on ? 'border-ink bg-ink text-white' : 'border-line bg-sheet text-ink hover:border-ink-muted'}`}>
                <input type="radio" name="task-status" value={t.id} checked={on} onChange={() => set({ status: t.id })} className="sr-only" />
                {t.label} <span className={`tabular-nums ${on ? 'text-white/75' : alert ? 'font-semibold text-alert' : 'text-ink-muted'}`}>{n}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <div>
          <label htmlFor="tf-owner" className="mb-1 block text-sm font-semibold text-ink">Owner</label>
          <select id="tf-owner" value={filter.owner} onChange={e => set({ owner: e.target.value })} className="field-control">
            <option value="">Anyone</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tf-step" className="mb-1 block text-sm font-semibold text-ink">Step</label>
          <select id="tf-step" value={filter.section} onChange={e => set({ section: e.target.value as SectionId | '' })} className="field-control">
            <option value="">Every step</option>
            {stepsWithTasks.map(s => <option key={s.id} value={s.id}>{s.number} {s.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tf-q" className="mb-1 block text-sm font-semibold text-ink">Search</label>
          <input id="tf-q" type="search" value={filter.q} onChange={e => set({ q: e.target.value })} className="field-control" placeholder="Task, owner or status" />
        </div>
        {filtered ? <button type="button" onClick={() => setFilter(DEFAULT_TASK_FILTER)} className="pb-2.5 text-sm font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">Reset filters</button> : <span />}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-ink-soft">
          {all.length === 0 ? 'No tasks yet. They appear here as you add channels, assets, team deliverables, milestones and risks.' : 'Nothing matches these filters.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-sheet">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="sr-only">{shown.length} task{shown.length === 1 ? '' : 's'}</caption>
            <thead>
              <tr className="bg-paper text-left">
                <th scope="col" className="w-[38%] border-b border-line px-3 py-2 font-semibold text-ink">Task</th>
                <th scope="col" className="w-[20%] border-b border-line px-3 py-2 font-semibold text-ink">Owner</th>
                <th scope="col" className="w-[18%] border-b border-line px-3 py-2 font-semibold text-ink">Due</th>
                <th scope="col" className="w-[24%] border-b border-line px-3 py-2 font-semibold text-ink">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(t => {
                const name = t.title || 'Untitled'
                const edit = (key: string, value: string | number) =>
                  dispatch({ type: 'setCell', section: t.sectionId, table: t.tableKey, rowId: t.rowId, key, value })
                const id = `task-${t.rowId}`
                return (
                  <tr key={t.rowId} className={`align-top ${t.overdue ? 'bg-alert-soft' : ''}`}>
                    <th scope="row" className="border-b border-line px-3 py-2 text-left font-normal">
                      <span className={`block font-semibold ${t.done ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink'}`}>{name}</span>
                      <span className="mt-0.5 block text-ink-muted">
                        <LinkButton onClick={() => onNavigate(t.sectionId)}>{t.sectionTitle}</LinkButton>
                        {t.overdue && <span className="ml-2 font-semibold text-alert">Overdue since {format(parseISO(t.due), 'd MMM')}</span>}
                      </span>
                    </th>
                    <td className="border-b border-line px-2 py-2">
                      <FieldInput id={`${id}-owner`} def={{ key: 'owner', label: 'Owner', type: 'text' }} value={t.owner} compact ariaLabel={`Owner, ${name}`} onChange={v => edit(t.mapping.ownerKey, v)} />
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      {t.mapping.dueKey
                        ? <FieldInput id={`${id}-due`} def={{ key: 'due', label: 'Due', type: 'date' }} value={t.due} compact ariaLabel={`Due date, ${name}`} onChange={v => edit(t.mapping.dueKey, v)} />
                        : <span className="block px-1 py-2 text-ink-muted">No due date</span>}
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      <FieldInput id={`${id}-status`} def={{ key: 'status', label: 'Status', type: 'select', options: t.statusOptions }} value={t.status} compact ariaLabel={`Status, ${name}`} onChange={v => edit(t.mapping.statusKey, v)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {readOnly && <p className="mt-3 text-sm text-ink-muted">You’re a viewer in this workspace, so tasks are read-only.</p>}
    </article>
  )
}
