// All edits to a project go through this pure reducer, so they are easy to test
// and later to autosave (Step 7) or send as activity diffs.
import { SECTION_BY_ID, tableDef } from '../config/sections'
import type { FunnelModel } from '../config/sections'
import type { CellValue, Motion, Project, SectionId } from '../config/types'
import { createRow } from '../engine/project'
import { applyFunnelModel, recalculateRoadmap, selectChannel, setLaunchDate, setMotion, unselectChannel } from '../engine/wiring'

export type ProjectAction =
  | { type: 'replace'; project: Project }
  | { type: 'rename'; name: string }
  | { type: 'setField'; section: SectionId; key: string; value: CellValue }
  | { type: 'setCell'; section: SectionId; table: string; rowId: string; key: string; value: CellValue }
  | { type: 'addRow'; section: SectionId; table: string; values?: Record<string, CellValue> }
  | { type: 'deleteRow'; section: SectionId; table: string; rowId: string }
  | { type: 'moveRow'; section: SectionId; table: string; rowId: string; direction: -1 | 1 }
  | { type: 'toggleCheck'; section: SectionId; itemId: string; checked: boolean }
  // Cross-section actions (Step 6)
  | { type: 'selectChannel'; channel: string }
  | { type: 'unselectChannel'; channel: string }
  | { type: 'setMotion'; motion: Motion; replaceFunnel: boolean }
  | { type: 'setFunnelModel'; model: FunnelModel }
  | { type: 'setLaunchDate'; date: string }
  | { type: 'recalculateRoadmap' }

const touch = (p: Project): Project => ({ ...p, updatedAt: new Date().toISOString() })
const withData = (p: Project, data: Project['data']): Project => (data === p.data ? p : touch({ ...p, data }))

function withSection(p: Project, section: SectionId, fn: (s: Project['data']['sections'][SectionId]) => Project['data']['sections'][SectionId]): Project {
  return touch({ ...p, data: { ...p.data, sections: { ...p.data.sections, [section]: fn(p.data.sections[section]) } } })
}

export function projectReducer(state: Project, action: ProjectAction): Project {
  switch (action.type) {
    case 'replace':
      return action.project
    case 'rename':
      return touch({ ...state, name: action.name })
    case 'setField': {
      const next = withSection(state, action.section, s => ({ ...s, fields: { ...s.fields, [action.key]: action.value } }))
      // The project name follows the product name until the user renames the project separately.
      if (action.section === 'brief' && action.key === 'product') {
        const oldProduct = String(state.data.sections.brief.fields.product ?? '')
        if (!state.name || state.name === oldProduct || /^New GTM project/.test(state.name)) return { ...next, name: String(action.value) || 'New GTM project' }
      }
      return next
    }
    case 'selectChannel':
      return withData(state, selectChannel(state.data, action.channel))
    case 'unselectChannel':
      return withData(state, unselectChannel(state.data, action.channel).data)
    case 'setMotion':
      return withData(state, setMotion(state.data, action.motion, action.replaceFunnel))
    case 'setFunnelModel':
      return withData(state, applyFunnelModel(state.data, action.model))
    case 'setLaunchDate':
      return withData(state, setLaunchDate(state.data, action.date).data)
    case 'recalculateRoadmap':
      return withData(state, recalculateRoadmap(state.data))
    case 'setCell':
      return withSection(state, action.section, s => ({
        ...s,
        tables: { ...s.tables, [action.table]: (s.tables[action.table] ?? []).map(r => (r.id === action.rowId ? { ...r, [action.key]: action.value } : r)) },
      }))
    case 'addRow': {
      const def = tableDef(SECTION_BY_ID[action.section], action.table)
      if (!def) return state
      return withSection(state, action.section, s => ({
        ...s, tables: { ...s.tables, [action.table]: [...(s.tables[action.table] ?? []), createRow({ ...def.blankRow, ...(action.values ?? {}) })] },
      }))
    }
    case 'deleteRow':
      return withSection(state, action.section, s => ({
        ...s, tables: { ...s.tables, [action.table]: (s.tables[action.table] ?? []).filter(r => r.id !== action.rowId) },
      }))
    case 'moveRow':
      return withSection(state, action.section, s => {
        const rows = [...(s.tables[action.table] ?? [])]
        const i = rows.findIndex(r => r.id === action.rowId), j = i + action.direction
        if (i < 0 || j < 0 || j >= rows.length) return s
        ;[rows[i], rows[j]] = [rows[j], rows[i]]
        return { ...s, tables: { ...s.tables, [action.table]: rows } }
      })
    case 'toggleCheck':
      return withSection(state, action.section, s => {
        const checks = { ...s.checks }
        if (action.checked) checks[action.itemId] = true
        else delete checks[action.itemId]
        return { ...s, checks }
      })
  }
}
