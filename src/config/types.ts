// Core types for the config-driven GTM planner.
// Every section, field, table and checklist is described as data in sections.ts;
// the UI renders from this config and the engine computes from it.

export const MOTIONS = ['Sales-led', 'Marketing-led', 'PLG', 'Partner-led', 'Hybrid'] as const
export type Motion = (typeof MOTIONS)[number]

export const PHASES = [
  { id: 'strategy', title: 'Strategy', intro: 'Decide who you serve, why they buy and how you price.' },
  { id: 'plan', title: 'Plan', intro: 'Turn strategy into channels, numbers, budget and assets.' },
  { id: 'readiness', title: 'Readiness', intro: 'Make sure people, data and risks are ready for launch day.' },
  { id: 'run', title: 'Run & Learn', intro: 'Operate the launch, learn from data and hand over.' },
] as const
export type PhaseId = (typeof PHASES)[number]['id']

export type SectionId =
  | 'brief' | 'research' | 'positioning' | 'pricing'
  | 'channels' | 'funnel' | 'budget' | 'assets'
  | 'tracking' | 'teams' | 'roadmap' | 'risks' | 'launch'
  | 'optimize' | 'cadence' | 'retro'

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'percent' | 'date' | 'select'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: readonly string[]
  default?: string | number
  placeholder?: string
  help?: string
  full?: boolean
}

export interface ColumnDef {
  key: string
  label: string
  type: FieldType
  options?: readonly string[]
}

/** Tables whose rows are work items feed the unified Tasks view and progress. */
export interface TaskMapping {
  titleKey: string
  ownerKey: string
  dueKey: string
  statusKey: string
}

export type CellValue = string | number
export type Row = { id: string } & Record<string, CellValue>

export interface TableDef {
  key: string
  title: string
  columns: readonly ColumnDef[]
  /** Starter rows; ids are generated when a project is created. */
  defaultRows: readonly Record<string, CellValue>[]
  /** Values for a newly added blank row. */
  blankRow: Record<string, CellValue>
  task?: TaskMapping
}

export interface ChecklistItem {
  /** Explicit, permanent ID. Never reuse or rename once shipped. */
  id: string
  label: string
  evidence: string
  owner: string
  /** If set, the item only applies to these motions. */
  motions?: readonly Motion[]
}

export interface Gate {
  /** Field references "sectionId.fieldKey" that must be non-empty. */
  fields?: readonly string[]
  /** Minimum share (0–1) of applicable checklist items that must be checked. */
  checklistMin?: number
  /** Minimum number of rows in a table that have all listed columns filled. */
  tableRows?: { table: string; min: number; requireCols: readonly string[] }
}

export interface SectionDef {
  id: SectionId
  number: string
  phase: PhaseId
  title: string
  intro: string
  fields?: readonly FieldDef[]
  tables?: readonly TableDef[]
  checklist?: readonly ChecklistItem[]
  /** Values owned by another section, shown read-only here ("sectionId.fieldKey"). */
  readOnlyRefs?: readonly string[]
  calculator?: 'funnel' | 'budget'
  notices?: readonly string[]
  gate: Gate
}

// ---- Stored data ----

export interface SectionData {
  fields: Record<string, CellValue>
  tables: Record<string, Row[]>
  checks: Record<string, boolean>
}

export interface ProjectData {
  schemaVersion: 2
  sections: Record<SectionId, SectionData>
}

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  data: ProjectData
}

export const DONE_STATUSES = ['Complete', 'Approved', 'Live', 'Resolved'] as const
export const isDone = (status: CellValue | undefined): boolean =>
  (DONE_STATUSES as readonly string[]).includes(String(status ?? ''))
