// Imports a project exported from the single-file prototype (gtm_launch_planner.html)
// into the v2 data model. Nothing is silently dropped: conflicting duplicates are
// merged into the surviving field and reported in `warnings`.

import { SECTION_BY_ID, funnelModelFor, tableDef } from '../config/sections'
import { MOTIONS } from '../config/types'
import type { CellValue, Motion, Project, Row, SectionId } from '../config/types'
import { applyFunnelTemplate, createProject, createRow, isFilled, toNumber } from './project'

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : [])
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
const cell = (v: unknown): CellValue => (typeof v === 'number' ? v : str(v))

export interface MigrationResult { project: Project; warnings: string[] }

/** Checklist items added in v2 that the prototype never had (used to rebuild legacy index order). */
const ADDED_IN_V2 = new Set(['trk-activation', 'lch-checkout'])
const GROUP_MAP: Record<string, SectionId> = { research: 'research', tracking: 'tracking', launch: 'launch', handover: 'retro' }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function migrateChecks(group: string, checks: Obj): Record<string, boolean> {
  const items = SECTION_BY_ID[GROUP_MAP[group]].checklist ?? []
  const bySlug = new Map(items.map(i => [slug(i.label), i.id]))
  const legacyOrder = items.filter(i => !ADDED_IN_V2.has(i.id))
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(checks)) {
    if (!v) continue
    let id: string | undefined
    if (/^\d+$/.test(k)) id = legacyOrder[Number(k)]?.id
    else id = bySlug.get(k.includes(':') ? k.split(':').slice(1).join(':') : k)
    if (id) out[id] = true
  }
  return out
}

function parseOffset(timing: string): number | '' {
  if (/launch/i.test(timing)) return 0
  const m = timing.replace('−', '-').match(/T\s*([+-])\s*(\d+)/i)
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : ''
}

function rowsFor(sectionId: SectionId, tableKey: string, src: Obj[], map: (r: Obj) => Record<string, CellValue> = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)]))): Row[] {
  const blank = tableDef(SECTION_BY_ID[sectionId], tableKey)!.blankRow
  return src.map(r => {
    const mapped = map(r)
    const kept = Object.fromEntries(Object.keys(blank).map(k => [k, mapped[k] ?? blank[k]]))
    return createRow(kept)
  })
}

function merge(primary: string, secondary: string, label: string, warnings: string[], note: string): string {
  if (!isFilled(primary)) return secondary
  if (!isFilled(secondary) || primary.trim() === secondary.trim()) return primary
  warnings.push(`${label}: the prototype had two different values; both kept in one field (${note}). Review and trim.`)
  return `${primary}\n\n[From prototype ${note}] ${secondary}`
}

export function migratePrototype(input: unknown): MigrationResult {
  const p = obj(input), d = obj(p.data)
  if (!Object.keys(d).length) throw new Error('Not a GTM prototype export: missing "data".')
  const warnings: string[] = []

  const b = obj(d.brief), pos = obj(d.positioning), ch = obj(d.channels), fu = obj(d.funnel)
  const motionRaw = str(b.motion)
  const motion: Motion = (MOTIONS as readonly string[]).includes(motionRaw) ? (motionRaw as Motion) : 'Hybrid'
  if (str(ch.motion) && str(ch.motion) !== motion) warnings.push(`Channel strategy motion "${str(ch.motion)}" differed from the brief motion "${motion}". v2 keeps only the brief motion.`)

  const project = createProject(str(p.name) || str(b.product) || 'Imported GTM project', motion)
  const S = project.data.sections
  const setFields = (sid: SectionId, src: Obj, keys: string[]) => { for (const k of keys) if (src[k] !== undefined) S[sid].fields[k] = cell(src[k]) }

  // Brief (ICP and value prop now live here only)
  setFields('brief', b, ['product', 'type', 'objective', 'launchDate', 'market', 'currency', 'target', 'owner', 'sponsor'])
  S.brief.fields.motion = motion
  S.brief.fields.budget = toNumber(cell(b.budget)) ?? ''
  S.brief.fields.icp = merge(str(pos.icp), str(b.audience), 'Primary ICP', warnings, 'brief audience')
  S.brief.fields.valueProp = merge(str(pos.value), str(b.valueProp), 'Value proposition', warnings, 'brief value proposition')

  const research = obj(d.research)
  setFields('research', research, ['notes', 'recommendation'])
  S.research.checks = migrateChecks('research', obj(research.checks))

  setFields('positioning', pos, ['secondary', 'buyer', 'pain', 'alternative', 'differentiation', 'proof', 'message', 'cta', 'objections'])

  // Channels: rows carry over; prototype "selected" list is implied by the rows in v2
  S.channels.tables.rows = rowsFor('channels', 'rows', arr(ch.rows))

  // Funnel: prototype had Lead → Opportunity → Customer rates; keep that shape, named per motion
  const model = funnelModelFor(motion)
  applyFunnelTemplate(S, model)
  const names = model === 'PLG / self-serve' ? ['Sign-up', 'Activated', 'Paid'] : ['Lead', 'Opportunity', 'Customer']
  const rates = [100, toNumber(cell(fu.leadRate)) ?? 10, toNumber(cell(fu.winRate)) ?? 20]
  S.funnel.tables.stages = names.map((stage, i) => createRow({ stage, rate: rates[i] }))
  S.funnel.fields.customers = toNumber(cell(fu.customers)) ?? ''
  S.funnel.fields.cost = toNumber(cell(fu.cpl)) ?? ''
  S.funnel.fields.revenue = toNumber(cell(fu.revenue)) ?? ''
  S.funnel.fields.margin = toNumber(cell(fu.margin)) ?? ''
  S.funnel.fields.notes = str(fu.notes)
  if (Array.isArray(d.kpiRows)) S.funnel.tables.kpis = rowsFor('funnel', 'kpis', arr(d.kpiRows))

  const assets = obj(d.assets)
  S.assets.tables.rows = rowsFor('assets', 'rows', arr(assets.rows))
  S.assets.tables.calendar = rowsFor('assets', 'calendar', arr(assets.calendar))

  S.budget.tables.rows = rowsFor('budget', 'rows', arr(obj(d.budget).rows), r => ({
    category: str(r.category), planned: toNumber(cell(r.planned)) ?? '', actual: toNumber(cell(r.actual)) ?? '', owner: str(r.owner),
  }))

  const tracking = obj(d.tracking)
  setFields('tracking', tracking, ['notes'])
  S.tracking.checks = migrateChecks('tracking', obj(tracking.checks))

  S.teams.tables.rows = rowsFor('teams', 'rows', arr(obj(d.teams).rows))

  const defaultDeps = new Map((tableDef(SECTION_BY_ID.roadmap, 'rows')!.defaultRows).map(r => [String(r.workstream), String(r.dependsOn)]))
  S.roadmap.tables.rows = rowsFor('roadmap', 'rows', arr(obj(d.roadmap).rows), r => ({
    timing: str(r.timing), offsetWeeks: parseOffset(str(r.timing)), workstream: str(r.workstream), deliverables: str(r.deliverables),
    exit: str(r.exit), dependsOn: defaultDeps.get(str(r.workstream)) ?? '', owner: str(r.owner), due: str(r.due), status: str(r.status) || 'Not started',
  }))

  S.risks.tables.rows = rowsFor('risks', 'rows', arr(obj(d.risks).rows))

  const launch = obj(d.launch)
  setFields('launch', launch, ['decision', 'decisionOwner', 'decisionDate', 'notes'])
  S.launch.checks = migrateChecks('launch', obj(launch.checks))

  const optimize = obj(d.optimize)
  S.optimize.tables.rows = rowsFor('optimize', 'rows', arr(optimize.rows))
  setFields('optimize', optimize, ['notes'])

  setFields('cadence', obj(d.meetings), ['cadence', 'attendees', 'agenda', 'notes'])

  const handover = obj(d.handover)
  setFields('retro', handover, ['notes'])
  S.retro.checks = migrateChecks('handover', obj(handover.checks))

  return { project, warnings }
}
