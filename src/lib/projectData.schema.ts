// Runtime validation for ProjectData read from the database or imported files.
// The jsonb column accepts any object, so the app checks shape before trusting it.
import { z } from 'zod'
import { SECTIONS } from '../config/sections'
import type { ProjectData, SectionId } from '../config/types'

const cell = z.union([z.string(), z.number()])
const row = z.object({ id: z.string().min(1) }).catchall(cell)
const section = z.object({
  fields: z.record(z.string(), cell),
  tables: z.record(z.string(), z.array(row)),
  checks: z.record(z.string(), z.boolean()),
})

const sectionIds = SECTIONS.map(s => s.id) as [SectionId, ...SectionId[]]

export const projectDataSchema = z.object({
  schemaVersion: z.literal(2),
  sections: z.object(Object.fromEntries(sectionIds.map(id => [id, section])) as Record<SectionId, typeof section>),
})

export function parseProjectData(input: unknown): ProjectData {
  const result = projectDataSchema.safeParse(input)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new Error(`Invalid project data at ${first.path.join('.') || '(root)'}: ${first.message}`)
  }
  return result.data as ProjectData
}
