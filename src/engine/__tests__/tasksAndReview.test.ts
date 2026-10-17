import { describe, expect, it } from 'vitest'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import { DEFAULT_TASK_FILTER, collectTasks, createProjectData, filterTasks, launchReview, migratePrototype, taskCounts, taskOwners, tasksCsv } from '..'
import { SECTIONS } from '../../config/sections'

const today = new Date('2026-10-17T12:00:00')
const data = migratePrototype(fixture).project.data
const tasks = collectTasks(data, today)

describe('tasks view logic', () => {
  it('counts open, due this week, unassigned and done work', () => {
    expect(taskCounts(tasks, today)).toEqual({ open: 51, overdue: 0, week: 1, unassigned: 0, done: 3, all: 54 })
  })

  it('filters by status, owner, step and search, sorted by due date', () => {
    const week = filterTasks(tasks, { ...DEFAULT_TASK_FILTER, status: 'week' }, today)
    expect(week.map(t => [t.due, t.title])).toEqual([['2026-10-20', 'Strategy']]) // the 20 Oct messaging doc is already approved
    const yoav = filterTasks(tasks, { ...DEFAULT_TASK_FILTER, owner: 'yoav (dev)' }, today)
    expect(yoav.length).toBeGreaterThan(3)
    expect(yoav.every(t => t.owner === 'Yoav (Dev)')).toBe(true)
    const risks = filterTasks(tasks, { ...DEFAULT_TASK_FILTER, section: 'risks' }, today)
    expect(risks).toHaveLength(7)
    expect(filterTasks(tasks, { ...DEFAULT_TASK_FILTER, q: 'paywall' }, today).map(t => t.title)).toEqual(['Paywall, Pro plan, share card shipped'])
    const open = filterTasks(tasks, DEFAULT_TASK_FILTER, today)
    const dated = open.filter(t => t.due).map(t => t.due)
    expect(dated).toEqual([...dated].sort())
    expect(open.findIndex(t => !t.due)).toBeGreaterThan(open.findLastIndex(t => !!t.due))
  })

  it('puts overdue work first', () => {
    const later = new Date('2026-11-12T12:00:00')
    const open = filterTasks(collectTasks(data, later), DEFAULT_TASK_FILTER, later)
    const firstNotOverdue = open.findIndex(t => !t.overdue)
    expect(firstNotOverdue).toBeGreaterThan(0)
    expect(open.slice(firstNotOverdue).some(t => t.overdue)).toBe(false)
  })

  it('lists owners once and exports CSV with quoting', () => {
    expect(taskOwners(tasks)).toEqual(['Dan (Growth)', 'Idan', 'Maya (Design)', 'Noa (Content)', 'Yoav (Dev)'])
    const csv = tasksCsv(filterTasks(tasks, { ...DEFAULT_TASK_FILTER, q: 'paywall' }, today))
    expect(csv).toBe('Task,Step,Owner,Due,Status,Overdue\r\n"Paywall, Pro plan, share card shipped",Team alignment & enablement,Yoav (Dev),2026-11-20,In progress,')
  })

  it('carries the editable columns and allowed statuses', () => {
    const asset = tasks.find(t => t.sectionId === 'assets')!
    expect(asset.mapping).toMatchObject({ ownerKey: 'owner', dueKey: 'due', statusKey: 'status' })
    expect(asset.statusOptions).toContain('Approved')
  })
})

describe('launch review', () => {
  it('names what blocks a go decision on the test plan', () => {
    const r = launchReview(data, today)
    expect(r.verdict).toBe('not-ready')
    expect(r.blockingSteps.map(b => b.sectionId)).toEqual(['pricing', 'tracking'])
    expect(r.highRisks).toHaveLength(5)
    expect(r.highRisks.every(x => !x.unmitigated)).toBe(true)
    expect(r.headline).toBe('Not ready for a go decision yet: 2 steps not ready.')
  })

  it('counts overdue work and unmitigated risks', () => {
    const d = structuredClone(data)
    d.sections.risks.tables.rows[1].mitigation = ''
    const r = launchReview(d, new Date('2026-11-12T12:00:00'))
    expect(r.headline).toMatch(/1 high-impact risk without a mitigation and owner, \d+ tasks overdue\.$/)
  })

  it('says ready when every pre-launch step is ready and nothing is overdue', () => {
    const d = createProjectData()
    const ready = launchReview(d, today)
    expect(ready.blockingSteps.length).toBe(SECTIONS.filter(s => s.phase !== 'run' && s.id !== 'launch').length)
  })
})
