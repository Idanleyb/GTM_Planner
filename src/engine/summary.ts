// One summary of a plan, built from its data. The Plan summary page and the
// Word download both render this model, so they always say the same thing.
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { SECTIONS, SECTION_BY_ID, checklistFor } from '../config/sections'
import { PHASES, isDone } from '../config/types'
import type { CellValue, Project, Row, SectionId } from '../config/types'
import { budgetSummary } from './budget'
import { computeFunnel, funnelInputsFrom } from './funnel'
import { projectProgress } from './progress'
import { motionOf, toNumber } from './project'
import { roadmapWarnings } from './roadmap'
import { collectTasks } from './tasks'

export interface KV { label: string; value: string }
export interface SummaryTable { columns: string[]; rows: string[][]; /** Relative column widths. */ widths: number[] }

export type SummaryBlock =
  | { kind: 'facts'; items: KV[] }
  | { kind: 'text'; label: string; text: string }
  | { kind: 'table'; title?: string; table: SummaryTable }
  | { kind: 'bullets'; title?: string; items: string[] }
  | { kind: 'empty'; text: string }

export interface SummarySection {
  id: string
  title: string
  /** Where to edit this part of the plan. */
  editSection: SectionId
  blocks: SummaryBlock[]
}

export interface PlanSummary {
  title: string
  subtitle: string
  generatedOn: string
  countdown: string | null
  keyFacts: KV[]
  readiness: { pct: number; ready: number; total: number; phases: SummaryTable }
  /** Steps not ready yet, with what is missing. */
  gaps: { step: string; sectionId: SectionId; missing: string[] }[]
  /** Overdue or due within 14 days, not done. */
  dueSoon: SummaryTable
  sections: SummarySection[]
}

export const NOT_SET = 'Not set'
const str = (v: CellValue | undefined) => String(v ?? '').trim()
const val = (v: CellValue | undefined) => str(v) || NOT_SET
const day = (s: string) => {
  const d = parseISO(s)
  return s && isValid(d) ? format(d, 'd MMM yyyy') : ''
}

export function moneyFmt(currency: string) {
  return (n: number | null) => (n === null ? NOT_SET : `${currency ? currency + ' ' : ''}${Math.round(n).toLocaleString('en-US')}`)
}

function textBlocks(fields: Record<string, CellValue>, keys: [string, string][]): SummaryBlock[] {
  return keys.filter(([k]) => str(fields[k])).map(([k, label]) => ({ kind: 'text', label, text: str(fields[k]) }))
}

function tableFrom(rows: Row[], cols: [string, string, number, ((r: Row) => string)?][]): SummaryTable {
  return {
    columns: cols.map(c => c[1]),
    widths: cols.map(c => c[2]),
    rows: rows.map(r => cols.map(([k, , , fmt]) => (fmt ? fmt(r) : str(r[k])) || '—')),
  }
}

const hasAny = (r: Row, keys: string[]) => keys.some(k => str(r[k]))

export function buildSummary(project: Project, today: Date = new Date()): PlanSummary {
  const d = project.data
  const S = d.sections
  const f = (sid: SectionId) => S[sid].fields
  const currency = str(f('brief').currency)
  const money = moneyFmt(currency)
  const motion = motionOf(d)
  const progress = projectProgress(d)
  const launch = str(f('brief').launchDate)
  const launchDate = parseISO(launch)
  const days = launch && isValid(launchDate) ? differenceInCalendarDays(launchDate, today) : null
  const countdown = days === null ? null : days === 0 ? 'Launch day' : days > 0 ? `T−${days} (${days} day${days === 1 ? '' : 's'} to launch)` : `T+${-days} (${-days} day${days === -1 ? '' : 's'} since launch)`
  const budget = budgetSummary(d)
  const funnel = computeFunnel(funnelInputsFrom(d))
  const decision = str(f('launch').decision) || 'Pending'

  // ---------------------------------------------------------------- header + readiness
  const keyFacts: KV[] = [
    { label: 'Launch date', value: launch ? `${day(launch)}${countdown ? `, ${countdown}` : ''}` : NOT_SET },
    { label: 'GTM motion', value: motion },
    { label: 'Target market', value: val(f('brief').market) },
    { label: 'Business target', value: val(f('brief').target) },
    { label: 'Launch budget', value: money(toNumber(f('brief').budget)) },
    { label: 'GTM owner', value: val(f('brief').owner) },
    { label: 'Executive sponsor', value: val(f('brief').sponsor) },
    { label: 'Go / no-go', value: `${decision}${str(f('launch').decisionDate) ? `, decision on ${day(str(f('launch').decisionDate))}` : ''}` },
  ]

  const phases: SummaryTable = {
    columns: ['Phase', 'Steps ready', 'Checks and tasks done'], widths: [3, 2, 2.4],
    rows: PHASES.map(p => {
      const ph = progress.byPhase[p.id]
      return [p.title, `${ph.ready} of ${ph.sections}`, `${ph.pct}%`]
    }),
  }

  const gaps = progress.sections.filter(s => s.state !== 'ready').map(s => ({
    step: `${SECTION_BY_ID[s.sectionId].number} ${SECTION_BY_ID[s.sectionId].title}`, sectionId: s.sectionId, missing: s.missing,
  }))

  const soonKey = format(new Date(today.getTime() + 14 * 86400000), 'yyyy-MM-dd')
  const due = collectTasks(d, today).filter(t => !t.done && t.due && t.due <= soonKey).sort((a, b) => a.due.localeCompare(b.due))
  const dueSoon: SummaryTable = {
    columns: ['Due', 'Task', 'Step', 'Owner', 'Status'], widths: [2, 5, 3, 2.5, 2],
    rows: due.map(t => [`${day(t.due)}${t.overdue ? ' (overdue)' : ''}`, t.title || '—', t.sectionTitle, t.owner || '—', t.status || '—']),
  }

  // ---------------------------------------------------------------- sections
  const sections: SummarySection[] = []
  const add = (id: string, title: string, editSection: SectionId, blocks: SummaryBlock[], emptyText = 'Nothing added yet.') =>
    sections.push({ id, title, editSection, blocks: blocks.length ? blocks : [{ kind: 'empty', text: emptyText }] })

  add('objective', 'Objective', 'brief', [
    ...textBlocks(f('brief'), [['objective', 'Business objective'], ['target', 'Revenue / adoption target']]),
    ...(str(f('research').recommendation) ? [{ kind: 'text' as const, label: 'Research recommendation', text: str(f('research').recommendation) }] : []),
  ])

  add('positioning', 'Customer and positioning', 'positioning', [
    ...textBlocks(f('brief'), [['icp', 'Primary ICP'], ['valueProp', 'Value proposition']]),
    ...textBlocks(f('positioning'), [
      ['secondary', 'Secondary ICP'], ['buyer', 'Buyer vs. user'], ['pain', 'Core pain point'], ['alternative', 'Current alternative'],
      ['differentiation', 'Differentiation'], ['proof', 'Proof points'], ['message', 'Primary message'], ['cta', 'Primary call to action'],
      ['objections', 'Objections and responses'],
    ]),
  ])

  const tiers = (S.pricing.tables.tiers ?? []).filter(r => hasAny(r, ['tier', 'price']))
  const pricingFacts = [['model', 'Pricing model'], ['entryOffer', 'Entry offer'], ['launchOffer', 'Launch offer']]
    .filter(([k]) => str(f('pricing')[k])).map(([k, label]) => ({ label, value: str(f('pricing')[k]) }))
  add('pricing', 'Pricing and packaging', 'pricing', [
    ...(pricingFacts.length ? [{ kind: 'facts' as const, items: pricingFacts }] : []),
    ...(tiers.length ? [{ kind: 'table' as const, table: tableFrom(tiers, [
      ['tier', 'Tier', 2], ['price', 'Price', 1.6, r => (toNumber(r.price) === null ? str(r.price) : money(toNumber(r.price)))],
      ['billing', 'Billing', 1.6], ['target', 'For', 2.4], ['limits', 'Limits', 2.2], ['features', 'Key features', 4],
    ]) }] : []),
    ...textBlocks(f('pricing'), [['discountRules', 'Discount rules'], ['wtpEvidence', 'Willingness-to-pay evidence']]),
  ])

  const channels = (S.channels.tables.rows ?? []).filter(r => str(r.channel))
  add('channels', 'Channels', 'channels', channels.length ? [{ kind: 'table', table: tableFrom(channels, [
    ['channel', 'Channel', 2.4], ['role', 'Role', 2.1], ['offer', 'Offer / message', 2.8], ['budget', 'Budget', 2, r => (toNumber(r.budget) === null ? '—' : money(toNumber(r.budget)))],
    ['kpi', 'KPI', 2.6], ['owner', 'Owner', 1.8], ['status', 'Status', 1.6],
  ]) }] : [], 'No channels selected yet.')

  const funnelBlocks: SummaryBlock[] = []
  if (funnel.valid) {
    funnelBlocks.push({ kind: 'table', title: `What it takes to reach ${funnel.volumes.at(-1)?.required.toLocaleString('en-US')} customers`, table: {
      columns: ['Stage', 'Conversion from previous', 'Required volume'], widths: [3, 3, 3],
      rows: funnel.volumes.map((v, i) => [v.stage, i === 0 ? '—' : `${toNumber(S.funnel.tables.stages[i]?.rate) ?? '—'}%`, v.required.toLocaleString('en-US')]),
    } })
    funnelBlocks.push({ kind: 'facts', items: [
      { label: 'First-stage spend', value: money(funnel.firstStageSpend) },
      { label: 'Cost per customer (CAC)', value: money(funnel.cac) },
      { label: 'First-year revenue', value: money(funnel.revenue) },
      { label: 'Gross profit', value: money(funnel.grossProfit) },
      { label: 'LTV : CAC', value: funnel.ltvToCac === null ? NOT_SET : `${funnel.ltvToCac.toFixed(1)} : 1` },
    ] })
  } else {
    funnelBlocks.push({ kind: 'bullets', title: 'The funnel can’t be calculated yet', items: funnel.errors })
  }
  const kpis = (S.funnel.tables.kpis ?? []).filter(r => str(r.target) || str(r.owner))
  if (kpis.length) funnelBlocks.push({ kind: 'table', title: 'KPI scorecard', table: tableFrom(kpis, [
    ['stage', 'Stage', 2], ['kpi', 'KPI', 3.2], ['target', 'Target', 3.2], ['baseline', 'Baseline', 2.2], ['owner', 'Owner', 2],
  ]) })
  funnelBlocks.push(...textBlocks(f('funnel'), [['notes', 'Assumptions']]))
  add('funnel', 'Funnel and KPIs', 'funnel', funnelBlocks)

  const budgetRows = (S.budget.tables.rows ?? []).filter(r => toNumber(r.planned) !== null || toNumber(r.actual) !== null)
  const budgetNote =
    budget.status === 'no-brief-budget' ? 'No total budget is set in the brief.'
    : budget.status === 'matches' ? `The plan matches the brief budget of ${money(budget.briefBudget)}.`
    : budget.status === 'over-plan' ? `The plan is ${money(budget.gapToBrief)} over the brief budget of ${money(budget.briefBudget)}.`
    : `${money(-(budget.gapToBrief ?? 0))} of the brief budget (${money(budget.briefBudget)}) is not allocated yet.`
  add('budget', 'Budget', 'budget', budgetRows.length ? [
    { kind: 'facts', items: [
      { label: 'Planned', value: money(budget.planned) }, { label: 'Spent', value: money(budget.actual) },
      { label: 'Remaining', value: money(budget.remaining) }, { label: 'Against the brief', value: budgetNote },
    ] },
    { kind: 'table', table: tableFrom(budgetRows, [
      ['category', 'Category', 4], ['planned', 'Planned', 2, r => money(toNumber(r.planned) ?? 0)], ['actual', 'Spent', 2, r => money(toNumber(r.actual) ?? 0)], ['owner', 'Owner', 2.4],
    ]) },
  ] : [], 'No budget lines yet.')

  const milestones = (S.roadmap.tables.rows ?? []).filter(r => str(r.workstream))
  const warnings = roadmapWarnings(milestones, today)
  add('roadmap', 'Roadmap', 'roadmap', milestones.length ? [
    { kind: 'table', table: tableFrom(milestones, [
      ['timing', 'When', 2], ['workstream', 'Workstream', 2.6], ['exit', 'Done when', 3.4], ['owner', 'Owner', 2], ['due', 'Due', 2, r => day(str(r.due))], ['status', 'Status', 1.8],
    ]) },
    ...(warnings.length ? [{ kind: 'bullets' as const, title: 'Needs attention', items: warnings.map(w => w.message) }] : []),
  ] : [])

  const risks = (S.risks.tables.rows ?? []).filter(r => str(r.risk) && !isDone(r.status))
  const rank = (r: Row) => ({ High: 0, Medium: 1, Low: 2 } as Record<string, number>)[str(r.impact)] ?? 3
  add('risks', 'Open risks', 'risks', risks.length ? [{ kind: 'table', table: tableFrom([...risks].sort((a, b) => rank(a) - rank(b)), [
    ['risk', 'Risk', 3], ['probability', 'Likelihood', 1.9], ['impact', 'Impact', 1.5], ['mitigation', 'Mitigation', 4.1], ['owner', 'Owner', 2], ['status', 'Status', 1.7],
  ]) }] : [], 'No open risks recorded.')

  const items = checklistFor(SECTION_BY_ID.launch, motion)
  const open = items.filter(i => !S.launch.checks[i.id])
  add('launch', 'Launch readiness', 'launch', [
    { kind: 'facts', items: [
      { label: 'Decision', value: decision },
      { label: 'Decision owner', value: val(f('launch').decisionOwner) },
      { label: 'Decision date', value: day(str(f('launch').decisionDate)) || NOT_SET },
      { label: 'Go / no-go checklist', value: `${items.length - open.length} of ${items.length} done` },
    ] },
    ...(open.length ? [{ kind: 'bullets' as const, title: 'Still open', items: open.map(i => `${i.label} (${i.owner})`) }] : []),
    ...textBlocks(f('launch'), [['notes', 'Conditions and blockers']]),
  ])

  add('cadence', 'How the launch is run', 'cadence', [
    ...[['cadence', 'Review cadence'], ['attendees', 'Attendees'], ['agenda', 'Agenda']].filter(([k]) => str(f('cadence')[k]))
      .map(([k, label]) => ({ kind: 'text' as const, label, text: str(f('cadence')[k]) })),
    ...(str(f('tracking').notes) ? [{ kind: 'text' as const, label: 'Measurement', text: str(f('tracking').notes) }] : []),
  ])

  const learned = textBlocks(f('retro'), [['worked', 'What worked'], ['didnt', 'What didn’t work'], ['reuse', 'Reuse next time']])
  if (learned.length) add('retro', 'Learnings', 'retro', learned)

  const type = str(f('brief').type)
  return {
    title: str(f('brief').product) || project.name,
    subtitle: [type, `${motion} motion`, launch ? `launching ${day(launch)}` : 'launch date not set'].filter(Boolean).join(', '),
    generatedOn: format(today, 'd MMM yyyy'),
    countdown,
    keyFacts,
    readiness: { pct: progress.overall.pct, ready: progress.sectionsReady.done, total: progress.sectionsReady.total, phases },
    gaps,
    dueSoon,
    sections,
  }
}

/** Plain-text paragraphs from a multi-line field (blank lines and bullets tidied). */
export function paragraphs(text: string): string[] {
  return text.split(/\n+/).map(l => l.replace(/^\s*[•\-*]\s*/, '').trim()).filter(Boolean)
}

/** Steps in plan order, for linking from the summary. */
export const STEP_ORDER = SECTIONS.map(s => s.id)
