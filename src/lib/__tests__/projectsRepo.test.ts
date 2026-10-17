import { describe, expect, it } from 'vitest'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import { createProject, migratePrototype } from '../../engine'
import type { ProjectRow } from '../database.types'
import { parseProjectData } from '../projectData.schema'
import { projectColumns, rowToProject } from '../projectsRepo'

describe('project data validation', () => {
  it('accepts a new project and a migrated prototype', () => {
    expect(() => parseProjectData(createProject().data)).not.toThrow()
    expect(() => parseProjectData(migratePrototype(fixture).project.data)).not.toThrow()
  })

  it('rejects malformed data with a path to the problem', () => {
    const bad = structuredClone(createProject().data) as unknown as { sections: { brief: { checks: Record<string, unknown> } } }
    bad.sections.brief.checks.x = 'yes'
    expect(() => parseProjectData(bad)).toThrow(/sections\.brief\.checks\.x/)
    expect(() => parseProjectData({ schemaVersion: 1, sections: {} })).toThrow(/schemaVersion/)
    const missing = structuredClone(createProject().data) as unknown as { sections: Record<string, unknown> }
    delete missing.sections.pricing
    expect(() => parseProjectData(missing)).toThrow(/sections\.pricing/)
  })
})

describe('row mapping', () => {
  const { project } = migratePrototype(fixture)

  it('lifts listing columns out of the plan', () => {
    const cols = projectColumns(project)
    expect(cols).toMatchObject({ name: 'Pimp My Prompt — Public launch (TEST DATA)', motion: 'PLG', launch_date: '2026-12-01', schema_version: 2 })
  })

  it('stores an invalid launch date as null instead of failing the save', () => {
    const p = structuredClone(project)
    p.data.sections.brief.fields.launchDate = 'next month'
    expect(projectColumns(p).launch_date).toBeNull()
  })

  it('round-trips through a database row', () => {
    const row: ProjectRow = {
      id: project.id, workspace_id: 'ws-1', ...projectColumns(project), version: 3,
      created_by: 'u1', updated_by: 'u2', created_at: project.createdAt, updated_at: project.updatedAt, archived_at: null,
    }
    const back = rowToProject(row)
    expect(back.data).toEqual(project.data)
    expect(back).toMatchObject({ id: project.id, workspaceId: 'ws-1', version: 3, name: project.name })
  })
})
