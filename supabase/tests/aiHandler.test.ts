// Runs the Edge Function's request handling with a fake Supabase and a fake Claude.
import { describe, expect, it, vi } from 'vitest'
import fixture from '../../src/test/fixtures/prototype-pimp-my-prompt.json'
import { SECTION_BY_ID } from '../../src/config/sections'
import { migratePrototype } from '../../src/engine'
import { buildAiRequest } from '../../src/ai/describe'
import { createHandler } from '../functions/ai-assist/handler'

const project = migratePrototype(fixture).project
const pricingReq = (action: 'draft' | 'critique' | 'fill' = 'draft') => buildAiRequest(action, SECTION_BY_ID.pricing, project, new Date('2026-10-17T12:00:00'))

interface World { user?: { id: string } | null; role?: string | null; projectVisible?: boolean; used?: number; inserts: unknown[] }

/** Chainable query fake that resolves to whatever the table/role combination should return. */
function fakeClient(world: World, isAdmin: boolean) {
  return {
    auth: { getUser: async () => ({ data: { user: world.user ?? null } }) },
    from(table: string) {
      const q = {
        select: () => q, eq: () => q, gte: () => q,
        maybeSingle: async () => {
          if (table === 'projects') return { data: world.projectVisible === false ? null : { id: project.id, workspace_id: 'ws1' } }
          if (table === 'workspace_members') return { data: world.role ? { role: world.role } : null }
          return { data: null }
        },
        then: (resolve: (v: unknown) => void) => resolve(isAdmin && table === 'ai_usage' ? { count: world.used ?? 0, error: null } : { data: null }),
        insert: async (row: unknown) => { world.inserts.push(row); return { error: null } },
      }
      return q
    },
  }
}

function setup(world: Partial<World> = {}, opts: { claude?: unknown; status?: number; env?: Record<string, string> } = {}) {
  const w: World = { user: { id: 'u1' }, role: 'editor', inserts: [], ...world }
  const env: Record<string, string> = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', AI_DAILY_LIMIT: '3', ...opts.env }
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(opts.claude ?? {
    content: [{ type: 'tool_use', name: 'propose_changes', input: { summary: 'Freemium with Pro.', fields: [{ key: 'model', value: 'Freemium + subscription', reason: 'PLG' }], rows: [{ table: 'tiers', values: { tier: 'Pro', price: '19' }, reason: '' }] } }],
    usage: { input_tokens: 1200, output_tokens: 300 },
  }), { status: opts.status ?? 200 }))
  const handler = createHandler({
    env: n => env[n], fetch: fetchMock as unknown as typeof fetch, log: () => {},
    createClient: (_u: string, key: string) => fakeClient(w, key === 'service'),
  })
  const call = (body: unknown = pricingReq()) => handler(new Request('https://fn/ai-assist', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify(body) }))
  return { w, fetchMock, call, handler }
}

describe('ai-assist handler', () => {
  it('returns validated proposals, logs usage and counts down the limit', async () => {
    const { call, w, fetchMock } = setup({ used: 1 })
    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.remaining).toBe(1)
    expect(body.result.fields).toEqual([{ key: 'model', label: 'Pricing model', value: 'Freemium + subscription', previous: '', reason: 'PLG' }])
    expect(body.result.rows[0].values).toEqual({ tier: 'Pro', price: 19 })
    expect(w.inserts).toEqual([expect.objectContaining({ user_id: 'u1', section_id: 'pricing', action: 'draft', model: 'claude-sonnet-5-5', input_tokens: 1200, output_tokens: 300 })])
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(sent.tool_choice).toEqual({ type: 'tool', name: 'propose_changes' })
    expect(sent.model).toBe('claude-sonnet-5-5')
    expect((fetchMock.mock.calls[0][1]!.headers as Record<string, string>)['x-api-key']).toBe('sk-test')
  })

  it('refuses before calling Claude when it should', async () => {
    const cases: [Partial<World>, Record<string, string>, number, string][] = [
      [{ user: null }, {}, 401, 'unauthenticated'],
      [{ projectVisible: false }, {}, 403, 'forbidden'],
      [{ role: null }, {}, 403, 'forbidden'],
      [{ role: 'viewer' }, {}, 403, 'viewer'],
      [{ used: 3 }, {}, 429, 'limit'],
      [{}, { ANTHROPIC_API_KEY: '' }, 503, 'not_configured'],
    ]
    for (const [world, env, status, code] of cases) {
      const { call, fetchMock, w } = setup(world, { env })
      const res = await call()
      expect([res.status, (await res.json()).code], JSON.stringify(world)).toEqual([status, code])
      expect(fetchMock).not.toHaveBeenCalled()
      expect(w.inserts).toEqual([])
    }
  })

  it('lets viewers ask for a critique', async () => {
    const { call } = setup({ role: 'viewer' }, { claude: { content: [{ type: 'tool_use', input: { summary: 'Thin.', findings: [{ severity: 'high', issue: 'No tiers', suggestion: 'Add Free and Pro' }] } }], usage: {} } })
    const res = await call(pricingReq('critique'))
    expect(res.status).toBe(200)
    expect((await res.json()).result.findings).toHaveLength(1)
  })

  it('explains upstream failures without leaking details and does not count them', async () => {
    for (const [status, msg] of [[529, /busy/], [401, /API key was rejected/], [500, /request failed/]] as const) {
      const { call, w } = setup({}, { status, claude: { error: { message: 'secret detail' } } })
      const res = await call()
      const body = await res.json()
      expect(res.status).toBe(502)
      expect(body.error).toMatch(msg)
      expect(JSON.stringify(body)).not.toMatch(/secret detail/)
      expect(w.inserts).toEqual([])
    }
  })

  it('rejects malformed and oversized requests and answers CORS preflight', async () => {
    const { call, handler } = setup()
    expect((await call({ projectId: project.id, action: 'nuke', section: pricingReq().section })).status).toBe(400)
    const huge = pricingReq(); huge.context = 'x'.repeat(250_000)
    expect((await call(huge)).status).toBe(413)
    const pre = await handler(new Request('https://fn/ai-assist', { method: 'OPTIONS' }))
    expect(pre.headers.get('Access-Control-Allow-Headers')).toMatch(/authorization/)
  })
})
