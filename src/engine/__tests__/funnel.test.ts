import { describe, expect, it } from 'vitest'
import { computeFunnel, createProjectData, funnelInputsFrom } from '..'

describe('computeFunnel', () => {
  it('reproduces the prototype numbers for the Pimp My Prompt test plan', () => {
    const r = computeFunnel({
      customers: 120, costPerFirstStage: 4, revenuePerCustomer: 228, marginPct: 82,
      stages: [{ stage: 'Sign-up', rate: 100 }, { stage: 'Activated', rate: 35 }, { stage: 'Paid', rate: 15 }],
    })
    expect(r.valid).toBe(true)
    expect(r.volumes.map(v => v.required)).toEqual([2286, 800, 120])
    expect(r.firstStageSpend).toBe(9144)
    expect(r.revenue).toBe(27360)
    expect(r.grossProfit).toBeCloseTo(22435.2)
    expect(r.cac).toBeCloseTo(76.2)
    expect(r.ltvToCac).toBeCloseTo(186.96 / 76.2)
  })

  it('handles a five-stage B2B pipeline', () => {
    const r = computeFunnel({
      customers: 10, costPerFirstStage: 50, revenuePerCustomer: 12000, marginPct: 70,
      stages: [{ stage: 'Lead', rate: 100 }, { stage: 'MQL', rate: 40 }, { stage: 'SQL', rate: 50 }, { stage: 'Opportunity', rate: 50 }, { stage: 'Customer', rate: 20 }],
    })
    expect(r.volumes.map(v => v.required)).toEqual([500, 200, 100, 50, 10])
    expect(r.firstStageSpend).toBe(25000)
  })

  it('reports invalid inputs instead of returning silent garbage', () => {
    const r = computeFunnel({ customers: 0, costPerFirstStage: 4, revenuePerCustomer: 10, marginPct: 50, stages: [{ stage: 'A', rate: 100 }, { stage: 'B', rate: 0 }] })
    expect(r.valid).toBe(false)
    expect(r.errors).toHaveLength(2)
    expect(r.volumes).toEqual([])
  })

  it('picks the funnel template from the motion', () => {
    expect(funnelInputsFrom(createProjectData('PLG')).stages.map(s => s.stage)).toEqual(['Sign-up', 'Activated', 'Paid'])
    expect(funnelInputsFrom(createProjectData('Sales-led')).stages.map(s => s.stage)).toEqual(['Lead', 'MQL', 'SQL', 'Opportunity', 'Customer'])
  })
})
