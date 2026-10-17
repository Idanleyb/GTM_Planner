// JSON files in and out. Exports use our own v2 format; imports accept that
// format or an export from the original single-file prototype.
import type { Project, ProjectData } from '../config/types'
import { migratePrototype } from '../engine/migrate'
import { parseProjectData } from './projectData.schema'

export const EXPORT_FORMAT = 'gtm-planner'

export interface ExportFile {
  format: typeof EXPORT_FORMAT
  schemaVersion: 2
  exportedAt: string
  name: string
  data: ProjectData
}

export function toExportFile(project: Pick<Project, 'name' | 'data'>, now = new Date()): ExportFile {
  return { format: EXPORT_FORMAT, schemaVersion: 2, exportedAt: now.toISOString(), name: project.name, data: project.data }
}

export interface ImportResult {
  name: string
  data: ProjectData
  source: 'gtm-planner' | 'prototype'
  warnings: string[]
}

export function parseImport(text: string): ImportResult {
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('This file isn’t valid JSON.') }
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  if (o.format === EXPORT_FORMAT) {
    return { name: String(o.name || 'Imported GTM project'), data: parseProjectData(o.data), source: 'gtm-planner', warnings: [] }
  }
  if (o.data && typeof o.data === 'object' && (o.data as Record<string, unknown>).brief) {
    const { project, warnings } = migratePrototype(json)
    return { name: project.name, data: project.data, source: 'prototype', warnings }
  }
  throw new Error('This isn’t a GTM Planner file. Choose a JSON export from this app or from the original prototype.')
}

export function fileNameFor(name: string): string {
  return (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gtm-plan') + '.json'
}

export function downloadProject(project: Pick<Project, 'name' | 'data'>) {
  const blob = new Blob([JSON.stringify(toExportFile(project), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileNameFor(project.name)
  a.click()
  URL.revokeObjectURL(url)
}
