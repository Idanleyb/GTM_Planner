import { FUNNEL_TEMPLATES, SECTIONS, SECTION_BY_ID, funnelModelFor, tableDef } from '../config/sections'
import { MOTIONS } from '../config/types'
import type { CellValue, Motion, Project, ProjectData, Row, SectionData, SectionId } from '../config/types'

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export function createRow(values: Record<string, CellValue>): Row {
  return { ...values, id: newId() }
}

function emptySection(sectionId: SectionId): SectionData {
  const def = SECTION_BY_ID[sectionId]
  const fields: Record<string, CellValue> = {}
  for (const f of def.fields ?? []) fields[f.key] = f.default ?? ''
  const tables: Record<string, Row[]> = {}
  for (const tb of def.tables ?? []) tables[tb.key] = tb.defaultRows.map(r => createRow({ ...tb.blankRow, ...r }))
  return { fields, tables, checks: {} }
}

export function createProjectData(motion: Motion = 'Hybrid'): ProjectData {
  const sections = Object.fromEntries(SECTIONS.map(s => [s.id, emptySection(s.id)])) as Record<SectionId, SectionData>
  sections.brief.fields.motion = motion
  applyFunnelTemplate(sections, funnelModelFor(motion))
  return { schemaVersion: 2, sections }
}

export function applyFunnelTemplate(sections: Record<SectionId, SectionData>, model: keyof typeof FUNNEL_TEMPLATES): void {
  sections.funnel.fields.model = model
  const blank = tableDef(SECTION_BY_ID.funnel, 'stages')!.blankRow
  sections.funnel.tables.stages = FUNNEL_TEMPLATES[model].map(r => createRow({ ...blank, ...r }))
}

export function createProject(name = 'New GTM project', motion: Motion = 'Hybrid', now = new Date()): Project {
  const iso = now.toISOString()
  return { id: newId(), name, createdAt: iso, updatedAt: iso, data: createProjectData(motion) }
}

/** Read a "sectionId.fieldKey" reference. */
export function getRef(data: ProjectData, ref: string): CellValue {
  const [sectionId, key] = ref.split('.') as [SectionId, string]
  return data.sections[sectionId]?.fields[key] ?? ''
}

export function motionOf(data: ProjectData): Motion {
  const m = String(getRef(data, 'brief.motion'))
  return (MOTIONS as readonly string[]).includes(m) ? (m as Motion) : 'Hybrid'
}

export const isFilled = (v: CellValue | undefined): boolean => v !== undefined && v !== null && String(v).trim() !== ''

/** Lenient number parsing: accepts 50000, "50,000", "50k", "1.2m". Returns null when empty or invalid. */
export function toNumber(v: CellValue | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const m = String(v).trim().toLowerCase().replace(/[,\s]/g, '').match(/^(-?\d*\.?\d+)([km]?)$/)
  if (!m) return null
  return parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1)
}
