// Cross-section rules (Step 6): when one part of the plan changes, keep the
// dependent parts consistent. All functions are pure and return new data.
import { addWeeks, format, isValid, parseISO } from 'date-fns'
import { CHANNEL_CATALOG, FUNNEL_TEMPLATES, SECTION_BY_ID, funnelModelFor, tableDef } from '../config/sections'
import type { FunnelModel } from '../config/sections'
import type { Motion, ProjectData, Row, SectionData, SectionId } from '../config/types'
import { createRow, isFilled, toNumber } from './project'

const withSection = (data: ProjectData, id: SectionId, fn: (s: SectionData) => SectionData): ProjectData =>
  ({ ...data, sections: { ...data.sections, [id]: fn(data.sections[id]) } })

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

// ---------------------------------------------------------------- channels

/** Archived channel rows live here; they are kept but not counted as tasks. */
export const ARCHIVED_CHANNELS = 'archived'

export function selectedChannels(data: ProjectData): Set<string> {
  return new Set((data.sections.channels.tables.rows ?? []).map(r => norm(r.channel)).filter(Boolean))
}

export function archivedChannels(data: ProjectData): Row[] {
  return data.sections.channels.tables[ARCHIVED_CHANNELS] ?? []
}

/** Add a channel row (or restore its archived row with everything that was filled in). */
export function selectChannel(data: ProjectData, channel: string): ProjectData {
  if (selectedChannels(data).has(norm(channel))) return data
  return withSection(data, 'channels', s => {
    const archived = s.tables[ARCHIVED_CHANNELS] ?? []
    const restored = archived.find(r => norm(r.channel) === norm(channel))
    const blank = tableDef(SECTION_BY_ID.channels, 'rows')!.blankRow
    const preset = CHANNEL_CATALOG.find(c => norm(c.channel) === norm(channel))
    const row = restored ?? createRow({ ...blank, channel: preset?.channel ?? channel, role: preset?.role ?? '', owner: preset?.owner ?? '' })
    return {
      ...s,
      tables: { ...s.tables, rows: [...(s.tables.rows ?? []), row], [ARCHIVED_CHANNELS]: archived.filter(r => r !== restored) },
    }
  })
}

/**
 * Remove a channel. Rows that only hold the preset values are deleted;
 * rows with work in them are archived so nothing typed is lost.
 */
export function unselectChannel(data: ProjectData, channel: string): { data: ProjectData; archived: number } {
  const rows = data.sections.channels.tables.rows ?? []
  const matching = rows.filter(r => norm(r.channel) === norm(channel))
  if (!matching.length) return { data, archived: 0 }
  const blank = tableDef(SECTION_BY_ID.channels, 'rows')!.blankRow
  const preset = CHANNEL_CATALOG.find(c => norm(c.channel) === norm(channel))
  const presetVals: Record<string, unknown> = { ...blank, channel: preset?.channel ?? channel, role: preset?.role ?? '', owner: preset?.owner ?? '' }
  const hasWork = (r: Row) => Object.keys(blank).some(k => isFilled(r[k]) && norm(r[k]) !== norm(presetVals[k]))
  const toArchive = matching.filter(hasWork)
  return {
    archived: toArchive.length,
    data: withSection(data, 'channels', s => ({
      ...s,
      tables: {
        ...s.tables,
        rows: rows.filter(r => !matching.includes(r)),
        [ARCHIVED_CHANNELS]: [...(s.tables[ARCHIVED_CHANNELS] ?? []), ...toArchive],
      },
    })),
  }
}

// ---------------------------------------------------------------- motion → funnel

export function currentFunnelModel(data: ProjectData): FunnelModel {
  const m = String(data.sections.funnel.fields.model)
  return m in FUNNEL_TEMPLATES ? (m as FunnelModel) : 'B2B pipeline'
}

/** True when the stages differ from the untouched template of the current model. */
export function isFunnelCustomized(data: ProjectData): boolean {
  const stages = data.sections.funnel.tables.stages ?? []
  const tpl = FUNNEL_TEMPLATES[currentFunnelModel(data)]
  if (stages.length !== tpl.length) return true
  return stages.some((r, i) => norm(r.stage) !== norm(tpl[i].stage) || (i > 0 && toNumber(r.rate) !== tpl[i].rate))
}

export interface MotionChangeImpact {
  modelChanges: boolean
  from: FunnelModel
  to: FunnelModel
  /** The user edited the stages, so replacing them needs confirmation. */
  needsConfirm: boolean
}

export function motionChangeImpact(data: ProjectData, motion: Motion): MotionChangeImpact {
  const from = currentFunnelModel(data), to = funnelModelFor(motion)
  return { from, to, modelChanges: from !== to, needsConfirm: from !== to && isFunnelCustomized(data) }
}

export function applyFunnelModel(data: ProjectData, model: FunnelModel): ProjectData {
  const blank = tableDef(SECTION_BY_ID.funnel, 'stages')!.blankRow
  return withSection(data, 'funnel', s => ({
    ...s,
    fields: { ...s.fields, model },
    tables: { ...s.tables, stages: FUNNEL_TEMPLATES[model].map(r => createRow({ ...blank, ...r })) },
  }))
}

/** Set the motion; swap the funnel model too unless the caller chose to keep the current stages. */
export function setMotion(data: ProjectData, motion: Motion, replaceFunnel: boolean): ProjectData {
  const next = withSection(data, 'brief', s => ({ ...s, fields: { ...s.fields, motion } }))
  const impact = motionChangeImpact(data, motion)
  return impact.modelChanges && replaceFunnel ? applyFunnelModel(next, impact.to) : next
}

// ---------------------------------------------------------------- launch date → roadmap

const validDate = (s: unknown) => {
  if (typeof s !== 'string' || !s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}
const dueFor = (launch: Date, offset: number) => format(addWeeks(launch, offset), 'yyyy-MM-dd')

/**
 * Change the launch date and move every roadmap date that was derived from the
 * old one. Dates the user typed by hand are kept and counted in `kept`.
 */
export function setLaunchDate(data: ProjectData, launchDate: string): { data: ProjectData; moved: number; kept: number } {
  const oldLaunch = validDate(data.sections.brief.fields.launchDate)
  const newLaunch = validDate(launchDate)
  let moved = 0, kept = 0
  let next = withSection(data, 'brief', s => ({ ...s, fields: { ...s.fields, launchDate } }))
  if (!newLaunch) return { data: next, moved, kept }
  next = withSection(next, 'roadmap', s => ({
    ...s,
    tables: {
      ...s.tables,
      rows: (s.tables.rows ?? []).map(r => {
        const offset = toNumber(r.offsetWeeks)
        if (offset === null) return r
        const auto = !r.due || (oldLaunch !== null && r.due === dueFor(oldLaunch, offset))
        if (!auto) { kept++; return r }
        const due = dueFor(newLaunch, offset)
        if (due !== r.due) moved++
        return { ...r, due }
      }),
    },
  }))
  return { data: next, moved, kept }
}

/** Reset every roadmap date to launch date + offset, including hand-typed ones. */
export function recalculateRoadmap(data: ProjectData): ProjectData {
  const launch = validDate(data.sections.brief.fields.launchDate)
  if (!launch) return data
  return withSection(data, 'roadmap', s => ({
    ...s,
    tables: {
      ...s.tables,
      rows: (s.tables.rows ?? []).map(r => {
        const offset = toNumber(r.offsetWeeks)
        return offset === null ? r : { ...r, due: dueFor(launch, offset) }
      }),
    },
  }))
}

/** Count roadmap rows whose date differs from launch date + offset (hand-set dates). */
export function manualRoadmapDates(data: ProjectData): number {
  const launch = validDate(data.sections.brief.fields.launchDate)
  if (!launch) return 0
  return (data.sections.roadmap.tables.rows ?? []).filter(r => {
    const offset = toNumber(r.offsetWeeks)
    return offset !== null && !!r.due && r.due !== dueFor(launch, offset)
  }).length
}
