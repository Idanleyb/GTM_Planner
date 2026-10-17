import { describe, expect, it } from 'vitest'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import { NOT_SET, buildSummary, createProject, migratePrototype, paragraphs } from '..'

const today = new Date('2026-10-17T12:00:00')

describe('plan summary', () => {
  const { project } = migratePrototype(fixture)
  const s = buildSummary(project, today)
  const section = (id: string) => s.sections.find(x => x.id === id)!

  it('summarises the header facts and readiness', () => {
    expect(s.title).toMatch(/Pimp My Prompt/)
    expect(s.subtitle).toBe('New product, PLG motion, launching 1 Dec 2026')
    expect(s.countdown).toBe('T−45 (45 days to launch)')
    expect(s.keyFacts.find(k => k.label === 'Launch budget')?.value).toBe('USD 15,000')
    expect(s.keyFacts.find(k => k.label === 'Go / no-go')?.value).toBe('Pending, decision on 27 Nov 2026')
    expect(s.readiness).toMatchObject({ pct: 16, ready: 12, total: 16 })
    expect(s.gaps.map(g => g.sectionId)).toEqual(['pricing', 'tracking', 'launch', 'retro'])
  })

  it('lists overdue and soon-due work', () => {
    expect(s.dueSoon.rows[0].slice(0, 3)).toEqual(['20 Oct 2026', 'Strategy', 'Execution roadmap'])
    expect(s.dueSoon.rows.some(r => r[0].includes('overdue'))).toBe(false)
    const later = buildSummary(project, new Date('2026-10-25T12:00:00'))
    expect(later.dueSoon.rows[0][0]).toBe('20 Oct 2026 (overdue)')
  })

  it('includes the funnel economics and channel table', () => {
    const funnel = section('funnel')
    const facts = funnel.blocks.find(b => b.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.items.find(i => i.label === 'First-stage spend')?.value).toBe('USD 9,144')
    const channels = section('channels').blocks[0]
    expect(channels.kind === 'table' && channels.table.rows).toHaveLength(8)
    expect(channels.kind === 'table' && channels.table.rows[1][3]).toBe('USD 6,500')
  })

  it('reports the budget against the brief and the open launch checks', () => {
    const budget = section('budget').blocks[0]
    expect(budget.kind === 'facts' && budget.items.find(i => i.label === 'Against the brief')?.value).toBe('The plan matches the brief budget of USD 15,000.')
    const launch = section('launch').blocks.find(b => b.kind === 'bullets')
    expect(launch && launch.kind === 'bullets' && launch.items).toHaveLength(11) // 12 PLG items, 1 done
  })

  it('sorts open risks by impact and flags roadmap problems', () => {
    const risks = section('risks').blocks[0]
    expect(risks.kind === 'table' && risks.table.rows.map(r => r[2])).toEqual(['High', 'High', 'High', 'High', 'High', 'Medium', 'Medium'])
    expect(section('roadmap').blocks.some(b => b.kind === 'bullets')).toBe(true)
  })

  it('handles an empty plan without inventing content', () => {
    const e = buildSummary(createProject('Blank', 'Sales-led'), today)
    expect(e.title).toBe('Blank')
    expect(e.countdown).toBeNull()
    expect(e.keyFacts.find(k => k.label === 'Launch date')?.value).toBe(NOT_SET)
    expect(e.sections.find(x => x.id === 'channels')?.blocks).toEqual([{ kind: 'empty', text: 'No channels selected yet.' }])
    expect(e.sections.find(x => x.id === 'funnel')?.blocks.map(b => b.kind)).toEqual(['table', 'facts']) // default funnel is valid
    expect(e.sections.find(x => x.id === 'retro')).toBeUndefined()
  })

  it('splits multi-line text into paragraphs', () => {
    expect(paragraphs('• one\n\n- two\nthree')).toEqual(['one', 'two', 'three'])
  })
})
