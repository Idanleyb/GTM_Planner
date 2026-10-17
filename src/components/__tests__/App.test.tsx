// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import { migratePrototype } from '../../engine'
import { memoryServices } from '../../services/memoryServices'
import { AiError } from '../../services/types'
import type { AiService } from '../../services/types'
import { validateResult } from '../../../supabase/functions/_shared/aiLogic'

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const rail = () => screen.getByRole('navigation', { name: 'Plan steps' })

/** Open the example plan in the editor, signed in as an owner. */
async function openSample(section = 'brief') {
  const sample = migratePrototype(fixture).project
  const svc = memoryServices({ projects: [sample] })
  window.location.hash = `#/p/${sample.id}/${section}`
  render(<App services={svc} />)
  await screen.findByRole('navigation', { name: 'Plan steps' })
  return { svc, sample }
}
const goTo = async (name: RegExp) => {
  await userEvent.setup().click(within(rail()).getByRole('button', { name }))
  await screen.findByRole('heading', { level: 1, name: new RegExp(name.source.replace(/\\/g, '')) })
}

describe('editor', () => {
  it('opens a plan on the brief with the countdown and all 16 steps', async () => {
    await openSample()
    expect(screen.getByRole('heading', { level: 1, name: 'GTM brief' })).toBeTruthy()
    expect((screen.getByLabelText('Product / offer') as HTMLInputElement).value).toMatch(/Pimp My Prompt/)
    expect(screen.getAllByText(/to launch|since launch|Launch day/).length).toBeGreaterThan(0)
    expect(within(rail()).getAllByRole('button')).toHaveLength(16)
  })

  it('updates the checklist and the step status when an item is checked', async () => {
    await openSample()
    await goTo(/Analytics & tracking/)
    expect(screen.getByText(/4 of 9 done/)).toBeTruthy()
    expect(screen.getByText(/2 items hidden because they don’t apply to a PLG motion/)).toBeTruthy()
    await userEvent.setup().click(screen.getByLabelText(/Define the activation event/))
    expect(screen.getByText(/5 of 9 done/)).toBeTruthy()
  })

  it('recalculates the funnel as inputs change', async () => {
    await openSample('funnel')
    const user = userEvent.setup()
    expect(screen.getByText('USD 9,144')).toBeTruthy()
    const customers = screen.getByLabelText('Target new customers')
    await user.clear(customers)
    await user.type(customers, '60')
    expect(screen.getByText('USD 4,572')).toBeTruthy()
    await user.clear(customers)
    expect(screen.getByText(/can’t be calculated yet/)).toBeTruthy()
  })

  it('turns a step ready once its gate is met', async () => {
    await openSample('pricing')
    const user = userEvent.setup()
    expect(screen.getAllByRole('listitem').some(li => li.textContent === 'Pricing model')).toBe(true)
    await user.selectOptions(screen.getByLabelText('Pricing model'), 'Freemium + subscription')
    await user.selectOptions(screen.getByLabelText('Entry offer'), 'Freemium')
    await user.click(screen.getByRole('button', { name: 'Add row' }))
    await user.type(screen.getByLabelText('Tier, row 1'), 'Pro')
    await user.type(screen.getByLabelText(/^Price, /), '19')
    expect(screen.getByText(/Ready — everything this step needs/)).toBeTruthy()
  })

  it('ticking a channel adds its row; unticking a worked-on channel archives it', async () => {
    await openSample('channels')
    const user = userEvent.setup()
    await user.click(screen.getByLabelText(/^PR \/ media/))
    expect((screen.getByLabelText('Channel, PR / media') as HTMLInputElement).value).toBe('PR / media')
    await user.click(screen.getByLabelText(/^Organic social/))
    expect(screen.queryByLabelText('Channel, Organic social')).toBeNull()
    expect(screen.getByText(/Organic social archived with its details/)).toBeTruthy()
    await user.click(screen.getByLabelText(/^Organic social/))
    expect((screen.getByLabelText('KPI, Organic social') as HTMLInputElement).value).toMatch(/600/)
  })

  it('switching the motion swaps the funnel model', async () => {
    await openSample()
    await userEvent.setup().selectOptions(screen.getByLabelText('Primary GTM motion'), 'Sales-led')
    expect(screen.getByText('Funnel switched to B2B pipeline stages.')).toBeTruthy()
    await goTo(/Funnel & KPIs/)
    expect((screen.getByLabelText('Funnel model') as HTMLSelectElement).value).toBe('B2B pipeline')
    expect((screen.getByLabelText('Stage, MQL') as HTMLInputElement).value).toBe('MQL')
  })

  it('moving the launch date moves the roadmap', async () => {
    await openSample()
    fireEvent.change(screen.getByLabelText('Target launch date'), { target: { value: '2026-12-15' } })
    expect(screen.getByText('13 roadmap dates moved with the launch date.')).toBeTruthy()
    await goTo(/Execution roadmap/)
    expect((screen.getByLabelText('Due date, Discovery') as HTMLInputElement).value).toBe('2026-10-20')
  })

  it('saves edits automatically', async () => {
    const { svc, sample } = await openSample()
    await userEvent.setup().type(screen.getByLabelText('Target market'), ' + DACH')
    await waitFor(async () => {
      expect((await svc.store.getProject(sample.id))?.data.sections.brief.fields.market).toMatch(/\+ DACH$/)
    }, { timeout: 3000 })
  })

  it('shows the conflict choice when someone else saved first', async () => {
    const { svc, sample } = await openSample()
    svc.simulateRemoteEdit(sample.id, p => { p.data.sections.brief.fields.target = 'Theirs' })
    await userEvent.setup().type(screen.getByLabelText('Target market'), '!')
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toMatch(/Someone else saved this plan/)
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Load their version' }))
    expect((screen.getByLabelText('Revenue / adoption target') as HTMLInputElement).value).toBe('Theirs')
  })

  it('is read-only for viewers', async () => {
    const sample = migratePrototype(fixture).project
    const svc = memoryServices({ projects: [sample] })
    svc.store.listWorkspaces = async () => [{ id: 'ws-demo', name: 'Client', role: 'viewer' }]
    window.location.hash = `#/p/${sample.id}/channels`
    render(<App services={svc} />)
    await screen.findByRole('navigation', { name: 'Plan steps' })
    expect((screen.getByLabelText('Channel, Paid social') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull()
    expect((screen.getByLabelText(/^PR \/ media/) as HTMLInputElement).disabled).toBe(true)
  })

  it('explains when a plan is not available', async () => {
    window.location.hash = '#/p/does-not-exist/brief'
    render(<App services={memoryServices()} />)
    expect(await screen.findByText('This plan isn’t available')).toBeTruthy()
  })
})

describe('sign-in, plans and team', () => {
  it('signs in, creates a plan and opens it', async () => {
    const svc = memoryServices({ user: null })
    render(<App services={svc} />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Work email'), 'idan@example.com')
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
    await screen.findByRole('heading', { level: 1, name: 'Plans' })
    expect(screen.getByText(/No plans yet/)).toBeTruthy()
    await user.type(screen.getByLabelText('Product or offer you’re launching'), 'BandMate for teachers')
    await user.selectOptions(screen.getByLabelText('GTM motion'), 'PLG')
    await user.click(screen.getByRole('button', { name: 'Create plan' }))
    await screen.findByRole('navigation', { name: 'Plan steps' })
    expect((screen.getByLabelText('Product / offer') as HTMLInputElement).value).toBe('BandMate for teachers')
    expect((screen.getByLabelText('Primary GTM motion') as HTMLSelectElement).value).toBe('PLG')
  })

  it('rejects an incomplete email address', async () => {
    render(<App services={memoryServices({ user: null })} />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Work email'), 'idan@')
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
    expect(screen.getByText(/Enter a full email address/)).toBeTruthy()
  })

  it('lists plans with progress, and archives and restores them', async () => {
    const sample = migratePrototype(fixture).project
    render(<App services={memoryServices({ projects: [sample] })} />)
    const row = (await screen.findByRole('link', { name: /Pimp My Prompt/ })).closest('li')!
    expect(within(row).getByText(/16% complete, 12 of 16 steps ready/)).toBeTruthy()
    const user = userEvent.setup()
    await user.click(within(row).getByRole('button', { name: 'Archive' }))
    expect(await screen.findByText(/No plans yet/)).toBeTruthy()
    await user.click(screen.getByLabelText('Show archived plans'))
    const archived = (await screen.findByRole('link', { name: /Pimp My Prompt/ })).closest('li')!
    await user.click(within(archived).getByRole('button', { name: 'Restore' }))
    await user.click(screen.getByLabelText('Show archived plans'))
    expect(await screen.findByRole('link', { name: /Pimp My Prompt/ })).toBeTruthy()
  })

  it('starts from the example plan', async () => {
    render(<App services={memoryServices()} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'start from the example plan' }))
    await screen.findByRole('navigation', { name: 'Plan steps' })
    expect((screen.getByLabelText('Product / offer') as HTMLInputElement).value).toMatch(/Pimp My Prompt/)
  })

  it('invites a teammate and keeps the last owner', async () => {
    window.location.hash = '#/team'
    render(<App services={memoryServices()} />)
    const user = userEvent.setup()
    await screen.findByRole('heading', { level: 1, name: 'Team' })
    await user.type(screen.getByLabelText('Email'), 'noa@example.com')
    await user.selectOptions(screen.getByLabelText('Role'), 'viewer')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))
    expect(await screen.findByText('noa@example.com')).toBeTruthy()
    expect(screen.getByText(/Invited noa@example.com as viewer/)).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Role for you@example.com'), 'editor')
    expect(await screen.findByText(/must keep at least one owner/)).toBeTruthy()
  })
})

describe('plan summary and Word download', () => {
  it('shows the plan on one page and links gaps to their step', async () => {
    await openSample('summary')
    expect(screen.getByRole('heading', { level: 1, name: /Pimp My Prompt/ })).toBeTruthy()
    expect(screen.getByText('New product, PLG motion, launching 1 Dec 2026')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: /Open risks/ })).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: '04 Pricing & packaging' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pricing & packaging' })).toBeTruthy()
  })

  it('downloads a Word file named after the plan', async () => {
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return 'blob:x' }) as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    const clicks: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download) })
    await openSample('summary')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download Word doc' }))
    await waitFor(() => expect(clicks).toHaveLength(1), { timeout: 5000 })
    expect(clicks[0]).toBe('GTM plan - pimp-my-prompt-public-launch-test-data.docx')
    expect(created[0].size).toBeGreaterThan(5000)
  })
})

describe('tasks view and readiness review', () => {
  it('lists open tasks across steps, filters them and edits inline', async () => {
    await openSample('tasks')
    const user = userEvent.setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeTruthy()
    expect(screen.getByText('51 tasks', { selector: 'caption' })).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Owner'), 'Yoav (Dev)')
    const caption = () => screen.getByText(/\d+ tasks?$/, { selector: 'caption' }).textContent
    expect(caption()).not.toBe('51 tasks')
    await user.type(screen.getByLabelText('Search'), 'paywall')
    expect(caption()).toBe('1 task')
    const status = screen.getByLabelText('Status, Paywall, Pro plan, share card shipped') as HTMLSelectElement
    await user.selectOptions(status, 'Complete')
    expect(screen.getByText('Nothing matches these filters.')).toBeTruthy() // done tasks leave the Open list
    await user.click(screen.getByRole('radio', { name: /^Done/ }))
    expect((screen.getByLabelText('Status, Paywall, Pro plan, share card shipped') as HTMLSelectElement).value).toBe('Complete')
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(caption()).toBe('50 tasks')
  })

  it('opens the task’s step from the list', async () => {
    await openSample('tasks')
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Risk register' })[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'Risk register' })).toBeTruthy()
  })

  it('shows what blocks a go decision on the Go / no-go step', async () => {
    await openSample('launch')
    const panel = screen.getByRole('region', { name: 'Readiness review' })
    expect(within(panel).getByText('Not ready for a go decision yet: 2 steps not ready.')).toBeTruthy()
    expect(within(panel).getByText('Launch delay')).toBeTruthy()
    await userEvent.setup().click(within(panel).getByRole('button', { name: '04 Pricing & packaging' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pricing & packaging' })).toBeTruthy()
  })
})

describe('AI assist', () => {
  /** A fake AI that answers like the Edge Function does, validated by the same shared code. */
  function fakeAi(answer: (action: string) => unknown, remaining = 29): AiService & { calls: string[] } {
    const calls: string[] = []
    return {
      calls,
      async run(req) {
        calls.push(`${req.action}:${req.section.id}`)
        return { result: validateResult(req, answer(req.action)), remaining, limit: 30 }
      },
    }
  }
  async function open(section: string, ai: AiService, role: 'owner' | 'viewer' = 'owner') {
    const sample = migratePrototype(fixture).project
    const svc = memoryServices({ projects: [sample] })
    svc.ai = ai
    if (role === 'viewer') svc.store.listWorkspaces = async () => [{ id: 'ws-demo', name: 'Client', role: 'viewer' }]
    window.location.hash = `#/p/${sample.id}/${section}`
    render(<App services={svc} />)
    await screen.findByRole('navigation', { name: 'Plan steps' })
    return { svc, sample }
  }

  it('drafts a step and applies suggestions only when asked', async () => {
    const ai = fakeAi(() => ({
      summary: 'Freemium with one paid tier, using the beta pricing evidence.',
      fields: [
        { key: 'model', value: 'Freemium + subscription', reason: 'PLG motion' },
        { key: 'entryOffer', value: 'Freemium', reason: 'Free tier drives activation' },
      ],
      rows: [{ table: 'tiers', values: { tier: 'Pro', price: '19', billing: 'Monthly' }, reason: 'From the brief target' }],
    }))
    await open('pricing', ai)
    const user = userEvent.setup()
    const panel = screen.getByRole('region', { name: 'AI assist' })
    await user.click(within(panel).getByRole('button', { name: 'Draft this step' }))
    expect(await within(panel).findByText('Freemium with one paid tier, using the beta pricing evidence.')).toBeTruthy()
    expect(within(panel).getByText('29 of 30 requests left today.', { exact: false })).toBeTruthy()
    expect((screen.getByLabelText('Pricing model') as HTMLSelectElement).value).toBe('') // nothing applied yet
    await user.click(within(panel).getByRole('button', { name: 'Apply Pricing model' }))
    expect((screen.getByLabelText('Pricing model') as HTMLSelectElement).value).toBe('Freemium + subscription')
    await user.click(within(panel).getByRole('button', { name: 'Skip Entry offer' }))
    expect((screen.getByLabelText('Entry offer') as HTMLSelectElement).value).toBe('')
    await user.click(within(panel).getByRole('button', { name: 'Apply row Pro' }))
    expect((screen.getByLabelText('Tier, Pro') as HTMLInputElement).value).toBe('Pro')
    expect((screen.getByLabelText('Price, Pro') as HTMLInputElement).value).toBe('19')
    expect(ai.calls).toEqual(['draft:pricing'])
  })

  it('applies everything at once', async () => {
    const ai = fakeAi(() => ({ summary: 'Filled.', fields: [{ key: 'model', value: 'Subscription', reason: '' }, { key: 'entryOffer', value: 'Free trial', reason: '' }], rows: [] }))
    await open('pricing', ai)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Fill the gaps' }))
    await user.click(await screen.findByRole('button', { name: 'Apply all' }))
    expect((screen.getByLabelText('Pricing model') as HTMLSelectElement).value).toBe('Subscription')
    expect((screen.getByLabelText('Entry offer') as HTMLSelectElement).value).toBe('Free trial')
  })

  it('shows a critique ranked by risk', async () => {
    const ai = fakeAi(() => ({ summary: 'Channels are solid but two gaps matter.', findings: [
      { severity: 'low', issue: 'Inconsistent owner names', suggestion: 'Use one name per person' },
      { severity: 'high', issue: 'Paid social budget exceeds the funnel spend', suggestion: 'Cut to USD 5,000 or raise the target' },
    ] }))
    await open('channels', ai)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Critique' }))
    const items = await screen.findAllByText(/High risk|Low/, { selector: 'span' })
    expect(items.map(i => i.textContent)).toEqual(['High risk', 'Low'])
    expect(screen.getByText('Paid social budget exceeds the funnel spend')).toBeTruthy()
  })

  it('lets viewers critique but not draft', async () => {
    await open('channels', fakeAi(() => ({ summary: 'ok', findings: [] })), 'viewer')
    const panel = screen.getByRole('region', { name: 'AI assist' })
    expect(within(panel).queryByRole('button', { name: 'Draft this step' })).toBeNull()
    expect(within(panel).getByRole('button', { name: 'Critique' })).toBeTruthy()
  })

  it('shows the limit message from the server', async () => {
    const ai: AiService = { async run() { throw new AiError('You’ve used all 30 AI requests for the last 24 hours. Try again later.', 'limit', 0) } }
    await open('brief', ai)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Draft this step' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/used all 30 AI requests/)
  })

  it('is hidden when AI isn’t available (demo mode)', async () => {
    await openSample('brief')
    expect(screen.queryByRole('region', { name: 'AI assist' })).toBeNull()
  })
})

