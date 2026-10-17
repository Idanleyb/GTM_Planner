import type { ProjectData } from '../config/types'
import { toNumber } from './project'

export interface BudgetSummary {
  planned: number
  actual: number
  remaining: number
  briefBudget: number | null
  /** planned − brief budget; positive means the plan exceeds the approved budget. */
  gapToBrief: number | null
  status: 'no-brief-budget' | 'matches' | 'over-plan' | 'under-plan'
  overspentCategories: string[]
}

export function budgetSummary(data: ProjectData): BudgetSummary {
  const rows = data.sections.budget.tables.rows ?? []
  let planned = 0, actual = 0
  const overspentCategories: string[] = []
  for (const r of rows) {
    const p = toNumber(r.planned) ?? 0, a = toNumber(r.actual) ?? 0
    planned += p; actual += a
    if (a > p) overspentCategories.push(String(r.category))
  }
  const briefBudget = toNumber(data.sections.brief.fields.budget)
  const gapToBrief = briefBudget === null ? null : planned - briefBudget
  const status = gapToBrief === null ? 'no-brief-budget' : gapToBrief === 0 ? 'matches' : gapToBrief > 0 ? 'over-plan' : 'under-plan'
  return { planned, actual, remaining: planned - actual, briefBudget, gapToBrief, status, overspentCategories }
}
