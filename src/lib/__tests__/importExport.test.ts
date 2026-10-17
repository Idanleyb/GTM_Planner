import { describe, expect, it } from 'vitest'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import { createProject } from '../../engine'
import { fileNameFor, parseImport, toExportFile } from '../importExport'

describe('import / export', () => {
  it('round-trips our own export format', () => {
    const p = createProject('Q4 launch', 'PLG')
    const r = parseImport(JSON.stringify(toExportFile(p)))
    expect(r).toMatchObject({ name: 'Q4 launch', source: 'gtm-planner', warnings: [] })
    expect(r.data).toEqual(p.data)
  })

  it('imports a prototype export with migration warnings', () => {
    const r = parseImport(JSON.stringify(fixture))
    expect(r.source).toBe('prototype')
    expect(r.name).toMatch(/Pimp My Prompt/)
    expect(r.warnings).toHaveLength(2)
  })

  it('explains what is wrong with other files', () => {
    expect(() => parseImport('not json')).toThrow(/valid JSON/)
    expect(() => parseImport('{"hello":1}')).toThrow(/isn’t a GTM Planner file/)
    const bad = toExportFile(createProject()) as unknown as { data: { schemaVersion: number } }
    bad.data.schemaVersion = 9
    expect(() => parseImport(JSON.stringify(bad))).toThrow(/schemaVersion/)
  })

  it('makes safe file names', () => {
    expect(fileNameFor('Pimp My Prompt — Launch (TEST)')).toBe('pimp-my-prompt-launch-test.json')
    expect(fileNameFor('—')).toBe('gtm-plan.json')
  })
})
