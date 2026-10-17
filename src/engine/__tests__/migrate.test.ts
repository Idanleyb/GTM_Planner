import { describe, expect, it } from 'vitest'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import { budgetSummary, collectTasks, computeFunnel, funnelInputsFrom, migratePrototype, projectProgress } from '..'

describe('prototype migration (Pimp My Prompt test plan)', () => {
  const { project, warnings } = migratePrototype(fixture)
  const S = project.data.sections

  it('carries the brief over, with ICP and value prop as the single source', () => {
    expect(project.name).toBe('Pimp My Prompt — Public launch (TEST DATA)')
    expect(S.brief.fields).toMatchObject({ motion: 'PLG', launchDate: '2026-12-01', budget: 15000, currency: 'USD' })
    expect(String(S.brief.fields.icp)).toMatch(/^In-house B2B\/B2C marketer/)
    expect(String(S.brief.fields.icp)).toContain('[From prototype brief audience]')
  })

  it('reports every conflict it merged', () => {
    expect(warnings).toHaveLength(2)
    expect(warnings.join(' ')).toMatch(/Primary ICP.*Value proposition/s)
  })

  it('keeps every checked item under its new permanent id', () => {
    expect(Object.keys(S.research.checks)).toHaveLength(6)
    expect(S.research.checks['res-baseline']).toBeUndefined()
    expect(Object.keys(S.tracking.checks).sort()).toEqual(['trk-events', 'trk-journey-qa', 'trk-stages', 'trk-utm'])
    expect(S.launch.checks).toEqual({ 'lch-pricing': true })
    expect(S.retro.checks).toEqual({ 'ho-brief': true, 'ho-research': true })
  })

  it('reproduces the funnel numbers shown in the prototype', () => {
    const r = computeFunnel(funnelInputsFrom(project.data))
    expect(r.volumes.map(v => [v.stage, v.required])).toEqual([['Sign-up', 2286], ['Activated', 800], ['Paid', 120]])
    expect(r.firstStageSpend).toBe(9144)
    expect(S.funnel.tables.kpis).toHaveLength(7)
  })

  it('migrates every table row with stable ids', () => {
    expect(S.channels.tables.rows).toHaveLength(8)
    expect(S.assets.tables.rows).toHaveLength(10)
    expect(S.assets.tables.calendar).toHaveLength(8)
    expect(S.risks.tables.rows).toHaveLength(7)
    expect(S.roadmap.tables.rows.map(r => r.offsetWeeks)).toEqual([-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4])
    const ids = Object.values(S).flatMap(s => Object.values(s.tables).flat().map(r => r.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('matches the prototype budget and open-task counts', () => {
    expect(budgetSummary(project.data)).toMatchObject({ planned: 15000, actual: 730, status: 'matches' })
    expect(collectTasks(project.data).filter(t => !t.done)).toHaveLength(51)
  })

  it('computes v2 progress (PLG-filtered checklists + new Pricing section)', () => {
    const p = projectProgress(project.data)
    expect(p.overall).toEqual({ done: 16, total: 101, pct: 16 })
    expect(p.sections.find(s => s.sectionId === 'pricing')?.state).toBe('not_started')
    expect(p.sections.find(s => s.sectionId === 'brief')?.state).toBe('ready')
  })

  it('rejects files that are not prototype exports', () => {
    expect(() => migratePrototype({ foo: 1 })).toThrow(/missing "data"/)
  })
})
