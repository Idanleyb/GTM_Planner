// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const rail = () => screen.getByRole('navigation', { name: 'Plan steps' })

describe('GTM Planner app', () => {
  it('opens on the brief with the test plan loaded and the countdown shown', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'GTM brief' })).toBeTruthy()
    expect((screen.getByLabelText('Product / offer') as HTMLInputElement).value).toMatch(/Pimp My Prompt/)
    expect(screen.getAllByText(/to launch|since launch|Launch day/).length).toBeGreaterThan(0)
    expect(within(rail()).getAllByRole('button')).toHaveLength(16)
  })

  it('updates the checklist and the step status when an item is checked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(rail()).getByRole('button', { name: /Analytics & tracking/ }))
    expect(screen.getByText(/4 of 9 done/)).toBeTruthy()
    expect(screen.getByText(/2 items hidden because they don’t apply to a PLG motion/)).toBeTruthy()
    await user.click(screen.getByLabelText(/Define the activation event/))
    expect(screen.getByText(/5 of 9 done/)).toBeTruthy()
  })

  it('recalculates the funnel as inputs change', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(rail()).getByRole('button', { name: /Funnel & KPIs/ }))
    expect(screen.getByText('USD 9,144')).toBeTruthy()
    const customers = screen.getByLabelText('Target new customers')
    await user.clear(customers)
    await user.type(customers, '60')
    expect(screen.getByText('USD 4,572')).toBeTruthy()
    await user.clear(customers)
    expect(screen.getByText(/can’t be calculated yet/)).toBeTruthy()
  })

  it('shows what is missing and turns ready once the gate is met', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(rail()).getByRole('button', { name: /Pricing & packaging/ }))
    expect(screen.getAllByRole('listitem').some(li => li.textContent === 'Pricing model')).toBe(true)
    await user.selectOptions(screen.getByLabelText('Pricing model'), 'Freemium + subscription')
    await user.selectOptions(screen.getByLabelText('Entry offer'), 'Freemium')
    await user.click(screen.getByRole('button', { name: 'Add row' }))
    await user.type(screen.getByLabelText('Tier, row 1'), 'Pro')
    await user.type(screen.getByLabelText(/^Price, /), '19')
    expect(screen.getByText(/Ready — everything this step needs/)).toBeTruthy()
  })

  it('switches to an empty project', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText('Working on'), 'new')
    expect((screen.getByLabelText('Product / offer') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: 'Set a launch date' })).toBeTruthy()
  })
})
