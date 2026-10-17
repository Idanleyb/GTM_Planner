import { describe, expect, it } from 'vitest'
import { createProject } from '../../engine'
import { projectReducer } from '../projectReducer'

describe('projectReducer', () => {
  const base = createProject('Test', 'PLG')

  it('sets fields without mutating the previous state', () => {
    const next = projectReducer(base, { type: 'setField', section: 'brief', key: 'product', value: 'Pimp My Prompt' })
    expect(next.data.sections.brief.fields.product).toBe('Pimp My Prompt')
    expect(base.data.sections.brief.fields.product).toBe('')
    expect(next.data.sections.research).toBe(base.data.sections.research) // untouched sections are shared
  })

  it('adds, edits, moves and deletes table rows by id', () => {
    let s = projectReducer(base, { type: 'addRow', section: 'channels', table: 'rows' })
    const [row] = s.data.sections.channels.tables.rows
    expect(row).toMatchObject({ status: 'Not started', channel: '' })
    s = projectReducer(s, { type: 'setCell', section: 'channels', table: 'rows', rowId: row.id, key: 'channel', value: 'Paid social' })
    s = projectReducer(s, { type: 'addRow', section: 'channels', table: 'rows' })
    s = projectReducer(s, { type: 'moveRow', section: 'channels', table: 'rows', rowId: row.id, direction: 1 })
    expect(s.data.sections.channels.tables.rows[1]).toMatchObject({ id: row.id, channel: 'Paid social' })
    s = projectReducer(s, { type: 'moveRow', section: 'channels', table: 'rows', rowId: row.id, direction: 1 })
    expect(s.data.sections.channels.tables.rows[1].id).toBe(row.id) // already last: no-op
    s = projectReducer(s, { type: 'deleteRow', section: 'channels', table: 'rows', rowId: row.id })
    expect(s.data.sections.channels.tables.rows.map(r => r.id)).not.toContain(row.id)
  })

  it('stores only checked items', () => {
    let s = projectReducer(base, { type: 'toggleCheck', section: 'research', itemId: 'res-icp', checked: true })
    expect(s.data.sections.research.checks).toEqual({ 'res-icp': true })
    s = projectReducer(s, { type: 'toggleCheck', section: 'research', itemId: 'res-icp', checked: false })
    expect(s.data.sections.research.checks).toEqual({})
  })

  it('renames and stamps updatedAt', () => {
    const s = projectReducer(base, { type: 'rename', name: 'Launch v2' })
    expect(s.name).toBe('Launch v2')
    expect(s.updatedAt >= base.updatedAt).toBe(true)
  })
})
