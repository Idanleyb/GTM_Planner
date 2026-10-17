// ai-assist request handling: drafts, gap-fills or critiques one step of a GTM plan with Claude.
// No Deno or npm imports here, so it can be unit-tested; index.ts wires it up.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  required
//   AI_MODEL           optional, default claude-sonnet-5-5
//   AI_DAILY_LIMIT     optional, requests per user per 24 h, default 30
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// The caller's own token is used to check access, so Row Level Security decides
// whether they can see the plan. Viewers may ask for a critique; drafting and
// gap-filling need editor or owner.
import { parseRequest, systemPrompt, toolFor, userPrompt, validateResult } from '../_shared/aiLogic.ts'

// Minimal surface of supabase-js used here, so tests can pass a fake.
// deno-lint-ignore no-explicit-any
type Client = any
export interface Deps {
  env: (name: string) => string | undefined
  createClient: (url: string, key: string, options?: Record<string, unknown>) => Client
  fetch: typeof fetch
  log?: (...args: unknown[]) => void
}

const MAX_BODY_BYTES = 200_000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => json({ error, code, ...extra }, status)

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  const env = deps.env
  const log = deps.log ?? console.error
  const MODEL = env('AI_MODEL') || 'claude-sonnet-5-5'
  const DAILY_LIMIT = Math.max(1, Number(env('AI_DAILY_LIMIT') || 30))

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    if (req.method !== 'POST') return fail(405, 'method', 'Use POST.')

    const apiKey = env('ANTHROPIC_API_KEY')
    if (!apiKey) return fail(503, 'not_configured', 'AI assist isn’t set up yet: the ANTHROPIC_API_KEY secret is missing.')

    const url = env('SUPABASE_URL')!
    const anon = env('SUPABASE_ANON_KEY')!
    const service = env('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const asUser = deps.createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: { user } } = await asUser.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (!user) return fail(401, 'unauthenticated', 'Your session has expired. Sign in again.')

    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'This step has too much content to send at once.')
    let body
    try { body = parseRequest(JSON.parse(raw)) } catch (e) { return fail(400, 'bad_request', e instanceof Error ? e.message : 'Invalid request.') }

    // Access: the plan must be visible to this user (RLS), and their role must allow the action.
    const { data: project } = await asUser.from('projects').select('id, workspace_id').eq('id', body.projectId).maybeSingle()
    if (!project) return fail(403, 'forbidden', 'This plan isn’t available to you.')
    const { data: member } = await asUser.from('workspace_members').select('role')
      .eq('workspace_id', project.workspace_id).eq('user_id', user.id).maybeSingle()
    if (!member) return fail(403, 'forbidden', 'You’re not a member of this plan’s workspace.')
    if (member.role === 'viewer' && body.action !== 'critique') return fail(403, 'viewer', 'Viewers can ask for a critique, but not drafts or gap-filling.')

    // Daily limit per user.
    const admin = deps.createClient(url, service, { auth: { persistSession: false } })
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count, error: countError } = await admin.from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since)
    if (countError) return fail(500, 'usage', 'Couldn’t check your AI usage. Has the ai_usage migration been run?')
    const used = count ?? 0
    if (used >= DAILY_LIMIT) {
      return fail(429, 'limit', `You’ve used all ${DAILY_LIMIT} AI requests for the last 24 hours. Try again later.`, { remaining: 0, limit: DAILY_LIMIT })
    }

    // Ask Claude, forcing the answer into the tool's JSON shape.
    const tool = toolFor(body)
    let response: Response
    try {
      response = await deps.fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4000,
          system: systemPrompt(),
          messages: [{ role: 'user', content: userPrompt(body) }],
          tools: [tool],
          tool_choice: { type: 'tool', name: tool.name },
        }),
      })
    } catch (e) {
      log('anthropic fetch failed', e)
      return fail(502, 'upstream', 'Couldn’t reach Claude. Try again in a minute.')
    }
    if (!response.ok) {
      const detail = await response.text()
      log('anthropic error', response.status, detail.slice(0, 500))
      const busy = response.status === 429 || response.status === 529
      const auth = response.status === 401 || response.status === 403
      return fail(502, 'upstream', busy ? 'Claude is busy right now. Try again in a minute.' : auth ? 'The Anthropic API key was rejected. Check the ANTHROPIC_API_KEY secret.' : 'The AI request failed. Try again.')
    }
    const message = await response.json()
    const toolUse = (message.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
    const result = validateResult(body, toolUse?.input)

    const { error: logError } = await admin.from('ai_usage').insert({
      user_id: user.id, project_id: project.id, section_id: body.section.id, action: body.action, model: MODEL,
      input_tokens: message.usage?.input_tokens ?? 0, output_tokens: message.usage?.output_tokens ?? 0,
    })
    if (logError) log('usage log failed', logError.message)

    return json({ result, remaining: Math.max(0, DAILY_LIMIT - used - 1), limit: DAILY_LIMIT, model: MODEL })
  }
}
