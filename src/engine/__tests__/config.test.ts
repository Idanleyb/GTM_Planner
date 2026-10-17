import { describe, expect, it } from 'vitest'
import { SECTIONS } from '../../config/sections'
import { PHASES } from '../../config/types'

describe('section config integrity', () => {
  it('has 16 sections, unique ids and sequential numbers', () => {
    expect(SECTIONS).toHaveLength(16)
    expect(new Set(SECTIONS.map(s => s.id)).size).toBe(16)
    expect(SECTIONS.map(s => s.number)).toEqual(SECTIONS.map((_, i) => String(i + 1).padStart(2, '0')))
  })

  it('keeps sections grouped by phase in phase order', () => {
    const order = PHASES.map(p => p.id)
    const idx = SECTIONS.map(s => order.indexOf(s.phase))
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })

  it('uses globally unique checklist ids', () => {
    const ids = SECTIONS.flatMap(s => (s.checklist ?? []).map(i => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only gates on fields, tables and columns that exist', () => {
    for (const s of SECTIONS) {
      for (const ref of s.gate.fields ?? []) {
        const [sid, key] = ref.split('.')
        const target = SECTIONS.find(x => x.id === sid)
        expect(target?.fields?.some(f => f.key === key), `${s.id} gate ${ref}`).toBe(true)
      }
      if (s.gate.tableRows) {
        const tb = s.tables?.find(t => t.key === s.gate.tableRows!.table)
        expect(tb, `${s.id} gate table`).toBeDefined()
        for (const c of s.gate.tableRows.requireCols) expect(tb!.columns.some(col => col.key === c), `${s.id}.${c}`).toBe(true)
      }
      if (s.gate.checklistMin !== undefined) expect(s.checklist?.length).toBeGreaterThan(0)
    }
  })

  it('maps every task table to real columns, including a status select', () => {
    for (const s of SECTIONS) for (const tb of s.tables ?? []) {
      if (!tb.task) continue
      const keys = tb.columns.map(c => c.key)
      for (const k of [tb.task.titleKey, tb.task.ownerKey, tb.task.statusKey]) expect(keys, `${s.id}.${tb.key}`).toContain(k)
      if (tb.task.dueKey) expect(keys).toContain(tb.task.dueKey)
      expect(tb.columns.find(c => c.key === tb.task!.statusKey)?.options?.length).toBeGreaterThan(1)
    }
  })

  it('has no duplicated single-source fields', () => {
    const fieldsNamed = (k: string) => SECTIONS.filter(s => s.fields?.some(f => f.key === k)).map(s => s.id)
    expect(fieldsNamed('motion')).toEqual(['brief'])
    expect(fieldsNamed('icp')).toEqual(['brief'])
    expect(fieldsNamed('valueProp')).toEqual(['brief'])
  })

  it('every read-only reference points at a real field', () => {
    for (const s of SECTIONS) for (const ref of s.readOnlyRefs ?? []) {
      const [sid, key] = ref.split('.')
      expect(SECTIONS.find(x => x.id === sid)?.fields?.some(f => f.key === key), ref).toBe(true)
    }
  })
})
