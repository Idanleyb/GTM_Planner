import { describe, expect, it } from 'vitest'
import { SECTION_BY_ID, checklistFor } from '../../config/sections'
import { createProjectData, projectProgress, sectionStatus } from '..'

describe('progress and gates', () => {
  it('starts every section as not started, with 0% overall', () => {
    const p = projectProgress(createProjectData('Hybrid'))
    expect(p.overall.pct).toBe(0)
    expect(p.sections.every(s => s.state === 'not_started')).toBe(true)
  })

  it('counts unchecked items in the total (prototype bug: 1 of 7 showed as 100%)', () => {
    const data = createProjectData()
    data.sections.research.checks['res-market-size'] = true
    const s = sectionStatus(SECTION_BY_ID.research, data)
    expect(s.checks).toEqual({ done: 1, total: 7 })
    expect(s.state).toBe('in_progress')
  })

  it('filters checklist items by motion', () => {
    const plg = checklistFor(SECTION_BY_ID.launch, 'PLG').map(i => i.id)
    const sales = checklistFor(SECTION_BY_ID.launch, 'Sales-led').map(i => i.id)
    expect(plg).toContain('lch-checkout')
    expect(plg).not.toContain('lch-routing')
    expect(sales).toContain('lch-routing')
    expect(sales).not.toContain('lch-checkout')
    expect(checklistFor(SECTION_BY_ID.launch, 'Hybrid').map(i => i.id)).toEqual(expect.arrayContaining(['lch-routing', 'lch-checkout']))
  })

  it('ignores checks on items that do not apply to the motion', () => {
    const data = createProjectData('PLG')
    data.sections.launch.checks['lch-routing'] = true
    expect(sectionStatus(SECTION_BY_ID.launch, data).checks.done).toBe(0)
  })

  it('marks the brief ready only when its gate fields are filled', () => {
    const data = createProjectData()
    const f = data.sections.brief.fields
    Object.assign(f, { product: 'X', objective: 'Y', launchDate: '2026-12-01', icp: 'Z' })
    let s = sectionStatus(SECTION_BY_ID.brief, data)
    expect(s.state).toBe('in_progress')
    expect(s.missing).toEqual(['GTM owner'])
    f.owner = 'Idan'
    s = sectionStatus(SECTION_BY_ID.brief, data)
    expect(s.state).toBe('ready')
  })

  it('names fields from other sections in gate messages', () => {
    expect(sectionStatus(SECTION_BY_ID.budget, createProjectData()).missing[0]).toBe('GTM brief → Total launch budget')
  })
})
