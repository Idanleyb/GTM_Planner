import { describe, expect, it } from 'vitest'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import {
  ARCHIVED_CHANNELS, collectTasks, createProjectData, isFunnelCustomized, manualRoadmapDates, materializeDates, migratePrototype,
  motionChangeImpact, recalculateRoadmap, selectChannel, selectedChannels, setLaunchDate, setMotion, unselectChannel,
} from '..'

describe('channel selection', () => {
  it('adds a row with the catalog role and owner', () => {
    const d = selectChannel(createProjectData(), 'Paid search')
    expect(d.sections.channels.tables.rows).toHaveLength(1)
    expect(d.sections.channels.tables.rows[0]).toMatchObject({ channel: 'Paid search', role: 'Conversion', owner: 'Marketing', status: 'Not started' })
    expect(selectChannel(d, 'paid search')).toBe(d) // already selected (case-insensitive): no change
  })

  it('deletes untouched rows but archives rows with work, and restores them on reselect', () => {
    let d = selectChannel(selectChannel(createProjectData(), 'Paid search'), 'SEO / AEO')
    const r1 = unselectChannel(d, 'Paid search')
    expect(r1.archived).toBe(0)
    expect(r1.data.sections.channels.tables[ARCHIVED_CHANNELS]).toEqual([])

    d.sections.channels.tables.rows[1].kpi = '1,500 visits'
    const r2 = unselectChannel(d, 'SEO / AEO')
    expect(r2.archived).toBe(1)
    expect(selectedChannels(r2.data).has('seo / aeo')).toBe(false)
    d = selectChannel(r2.data, 'SEO / AEO')
    expect(d.sections.channels.tables.rows.find(r => r.channel === 'SEO / AEO')?.kpi).toBe('1,500 visits')
    expect(d.sections.channels.tables[ARCHIVED_CHANNELS]).toEqual([])
  })

  it('keeps archived channels out of the task list', () => {
    let d = selectChannel(createProjectData(), 'PR / media')
    d.sections.channels.tables.rows[0].owner = 'Idan'
    d = unselectChannel(d, 'PR / media').data
    expect(collectTasks(d).filter(t => t.sectionId === 'channels')).toHaveLength(0)
  })
})

describe('motion → funnel model', () => {
  it('swaps an untouched funnel without asking', () => {
    const d = createProjectData('Sales-led')
    expect(motionChangeImpact(d, 'PLG')).toMatchObject({ modelChanges: true, needsConfirm: false, to: 'PLG / self-serve' })
    const next = setMotion(d, 'PLG', true)
    expect(next.sections.funnel.tables.stages.map(r => r.stage)).toEqual(['Sign-up', 'Activated', 'Paid'])
    expect(next.sections.brief.fields.motion).toBe('PLG')
  })

  it('asks before replacing customized stages, and can keep them', () => {
    const d = createProjectData('Sales-led')
    d.sections.funnel.tables.stages[1].rate = 55
    expect(isFunnelCustomized(d)).toBe(true)
    expect(motionChangeImpact(d, 'PLG').needsConfirm).toBe(true)
    const kept = setMotion(d, 'PLG', false)
    expect(kept.sections.brief.fields.motion).toBe('PLG')
    expect(kept.sections.funnel.tables.stages[1].rate).toBe(55)
  })

  it('does nothing to the funnel when both motions use the same model', () => {
    const d = createProjectData('Sales-led')
    expect(motionChangeImpact(d, 'Hybrid').modelChanges).toBe(false)
    expect(setMotion(d, 'Hybrid', true).sections.funnel).toBe(d.sections.funnel)
  })
})

describe('launch date → roadmap', () => {
  const withDates = () => {
    const d = createProjectData()
    d.sections.brief.fields.launchDate = '2026-12-01'
    d.sections.roadmap.tables.rows = materializeDates('2026-12-01', d.sections.roadmap.tables.rows)
    return d
  }

  it('moves derived dates and keeps hand-set ones', () => {
    const d = withDates()
    d.sections.roadmap.tables.rows[0].due = '2026-10-01' // manual
    const r = setLaunchDate(d, '2026-12-15')
    expect(r.kept).toBe(1)
    expect(r.moved).toBe(12)
    expect(r.data.sections.roadmap.tables.rows[0].due).toBe('2026-10-01')
    expect(r.data.sections.roadmap.tables.rows[8].due).toBe('2026-12-15')
    expect(r.data.sections.brief.fields.launchDate).toBe('2026-12-15')
  })

  it('fills empty dates on the first launch date', () => {
    const r = setLaunchDate(createProjectData(), '2026-12-01')
    expect(r.moved).toBe(13)
    expect(r.data.sections.roadmap.tables.rows[0].due).toBe('2026-10-06')
  })

  it('leaves the roadmap alone when the date is cleared or invalid', () => {
    const d = withDates()
    const r = setLaunchDate(d, '')
    expect(r.data.sections.roadmap).toBe(d.sections.roadmap)
  })

  it('counts and resets hand-set dates on request', () => {
    const d = withDates()
    d.sections.roadmap.tables.rows[2].due = '2026-01-01'
    expect(manualRoadmapDates(d)).toBe(1)
    expect(manualRoadmapDates(recalculateRoadmap(d))).toBe(0)
  })

  it('works on the migrated test plan', () => {
    const { project } = migratePrototype(fixture)
    expect(manualRoadmapDates(project.data)).toBe(0)
    const r = setLaunchDate(project.data, '2026-12-08')
    expect(r).toMatchObject({ moved: 13, kept: 0 })
  })
})
