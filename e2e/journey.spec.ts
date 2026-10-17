import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

async function signInDemo(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.getByRole('button', { name: 'Try it without an account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Plans' })).toBeVisible()
}

test('a marketer builds a plan from scratch', async ({ page }) => {
  page.on('dialog', d => d.accept())
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await signInDemo(page)

  // Create
  await page.getByLabel('Product or offer you’re launching').fill('BandMate for teachers')
  await page.getByLabel('GTM motion').selectOption('PLG')
  await page.getByRole('button', { name: 'Create plan' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'GTM brief' })).toBeVisible()
  await expect(page.getByLabel('Product / offer')).toHaveValue('BandMate for teachers')

  // Brief: launch date moves the roadmap; the brief turns ready
  await page.getByLabel('Business objective').fill('300 paying teachers in 90 days')
  await page.getByLabel('Primary ICP').fill('Private guitar teachers with 10+ students')
  await page.getByLabel('GTM owner').fill('Idan')
  await page.getByLabel('Target launch date').fill('2027-03-01')
  await expect(page.getByText('13 roadmap dates moved with the launch date.')).toBeVisible()
  await expect(page.getByText(/Ready — everything this step needs/)).toBeVisible()

  // Channels: tick two
  await page.getByRole('navigation', { name: 'Plan steps' }).getByRole('button', { name: /Channel strategy/ }).click()
  await page.getByLabel(/^Paid social/).check()
  await page.getByLabel(/^Email \/ lifecycle/).check()
  await expect(page.getByLabel('Channel, Paid social')).toHaveValue('Paid social')

  // Funnel uses the PLG template
  await page.getByRole('navigation', { name: 'Plan steps' }).getByRole('button', { name: /Funnel & KPIs/ }).click()
  await expect(page.getByLabel('Stage, Activated')).toHaveValue('Activated')

  // Tasks lists the new channel rows
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()
  await page.getByLabel('Step', { exact: true }).selectOption('channels')
  await expect(page.getByLabel('Owner, Paid social')).toBeVisible()

  // Summary + Word download
  await page.getByRole('button', { name: 'Plan summary' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'BandMate for teachers' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Word doc' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('GTM plan - bandmate-for-teachers.docx')
  const bytes = readFileSync(await file.path())
  expect(bytes.subarray(0, 2).toString()).toBe('PK') // a real .docx (zip)
  expect(bytes.length).toBeGreaterThan(8000)

  // Back to the list: the plan is there with its countdown
  await page.getByRole('link', { name: 'All plans' }).first().click()
  await expect(page.getByRole('link', { name: 'BandMate for teachers' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the example plan opens with its readiness review', async ({ page }) => {
  await signInDemo(page)
  await page.getByRole('button', { name: 'start from the example plan' }).click()
  await page.getByRole('navigation', { name: 'Plan steps' }).getByRole('button', { name: /Go \/ no-go/ }).click()
  const review = page.getByRole('region', { name: 'Readiness review' })
  await expect(review).toContainText('Not ready for a go decision yet')
  await review.getByRole('button', { name: '04 Pricing & packaging' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Pricing & packaging' })).toBeVisible()
})

test('works on a phone @mobile', async ({ page }) => {
  await signInDemo(page)
  await page.getByRole('button', { name: 'start from the example plan' }).click()
  await page.getByLabel('Go to step').selectOption('tasks')
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1) // no sideways page scroll
})
