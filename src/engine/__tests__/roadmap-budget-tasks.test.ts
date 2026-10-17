import { describe, expect, it } from 'vitest'
import { budgetSummary, collectTasks, createProjectData, materializeDates, roadmapWarnings } from '..'

describe('roadmap', () => {
  it('derives due dates from the launch date', () => {
    const rows = materializeDates('2026-12-01', createProjectData().sections.roadmap.tables.rows)
    expect(rows[0].due).toBe('2026-10-06') // T−8 weeks
    expect(rows[8].due).toBe('2026-12-01') // launch week
    expect(rows[12].due).toBe('2026-12-29') // T+4 weeks
  })

  it('keeps manually set dates unless asked to overwrite', () => {
    const rows = createProjectData().sections.roadmap.tables.rows
    rows[0].due = '2026-10-01'
    expect(materializeDates('2026-12-01', rows)[0].due).toBe('2026-10-01')
    expect(materializeDates('2026-12-01', rows, true)[0].due).toBe('2026-10-06')
  })

  it('warns when work starts before its dependency is complete, and on overdue items', () => {
    const rows = materializeDates('2026-12-01', createProjectData().sections.roadmap.tables.rows)
    rows[1].status = 'In progress' // ICP & positioning depends on Discovery (not complete)
    const w = roadmapWarnings(rows, new Date('2026-10-17'))
    expect(w.find(x => x.kind === 'dependency')?.message).toContain('Discovery')
    expect(w.filter(x => x.kind === 'overdue').map(x => x.rowId)).toEqual([rows[0].id, rows[1].id])
  })
})

describe('budget', () => {
  it('compares the plan with the brief budget', () => {
    const data = createProjectData()
    data.sections.brief.fields.budget = 10000
    const rows = data.sections.budget.tables.rows
    rows[0].planned = 8000; rows[0].actual = 9000; rows[1].planned = '3k'
    const b = budgetSummary(data)
    expect(b).toMatchObject({ planned: 11000, actual: 9000, remaining: 2000, gapToBrief: 1000, status: 'over-plan', overspentCategories: ['Paid media'] })
  })
})

describe('tasks', () => {
  it('collects work items from every task table, with overdue flags', () => {
    const data = createProjectData()
    data.sections.assets.tables.rows[0].due = '2026-10-01'
    const tasks = collectTasks(data, new Date('2026-10-17'))
    expect(new Set(tasks.map(t => t.sectionId))).toEqual(new Set(['assets', 'teams', 'roadmap', 'risks']))
    expect(tasks.filter(t => t.overdue)).toHaveLength(1)
  })
})
