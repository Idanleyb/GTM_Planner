import type { ProjectData } from '../config/types'
import { toNumber } from './project'

export interface FunnelInputs {
  customers: number
  /** Cost per unit entering the first stage (per lead, per sign-up, ...). */
  costPerFirstStage: number
  revenuePerCustomer: number
  marginPct: number
  /** Ordered stages; rate = % conversion from the previous stage (ignored for the first). */
  stages: { stage: string; rate: number }[]
}

export interface FunnelResult {
  valid: boolean
  errors: string[]
  /** Required volume at each stage, top to bottom; the last equals target customers. */
  volumes: { stage: string; required: number }[]
  firstStageSpend: number
  revenue: number
  grossProfit: number
  /** First-stage spend divided by target customers. */
  cac: number | null
  /** First-year gross profit per customer divided by CAC. */
  ltvToCac: number | null
}

export function computeFunnel(input: FunnelInputs): FunnelResult {
  const errors: string[] = []
  const { customers, stages } = input
  if (!(customers > 0)) errors.push('Target customers must be above 0.')
  if (stages.length < 2) errors.push('Add at least two funnel stages.')
  stages.slice(1).forEach(s => {
    if (!(s.rate > 0 && s.rate <= 100)) errors.push(`Conversion into "${s.stage || 'unnamed stage'}" must be between 0 and 100%.`)
  })
  const revenue = Math.max(0, customers) * input.revenuePerCustomer
  const grossProfit = revenue * input.marginPct / 100
  if (errors.length) {
    return { valid: false, errors, volumes: [], firstStageSpend: 0, revenue, grossProfit, cac: null, ltvToCac: null }
  }

  // Work backward: required(stage i-1) = ceil(required(stage i) / rate_i)
  const required: number[] = new Array(stages.length)
  required[stages.length - 1] = Math.ceil(customers)
  for (let i = stages.length - 1; i > 0; i--) required[i - 1] = Math.ceil(required[i] / (stages[i].rate / 100))

  const firstStageSpend = required[0] * input.costPerFirstStage
  const cac = firstStageSpend / customers
  const gpPerCustomer = input.revenuePerCustomer * input.marginPct / 100
  return {
    valid: true, errors,
    volumes: stages.map((s, i) => ({ stage: s.stage, required: required[i] })),
    firstStageSpend, revenue, grossProfit, cac,
    ltvToCac: cac > 0 ? gpPerCustomer / cac : null,
  }
}

export function funnelInputsFrom(data: ProjectData): FunnelInputs {
  const f = data.sections.funnel
  return {
    customers: toNumber(f.fields.customers) ?? 0,
    costPerFirstStage: toNumber(f.fields.cost) ?? 0,
    revenuePerCustomer: toNumber(f.fields.revenue) ?? 0,
    marginPct: toNumber(f.fields.margin) ?? 0,
    stages: (f.tables.stages ?? []).map(r => ({ stage: String(r.stage ?? ''), rate: toNumber(r.rate) ?? 0 })),
  }
}
