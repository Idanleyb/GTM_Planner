// ai-assist Edge Function entry point. Logic lives in handler.ts.
// Secrets: ANTHROPIC_API_KEY (required), AI_MODEL, AI_DAILY_LIMIT. See docs/AI_SETUP.md.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: name => Deno.env.get(name), createClient, fetch }))
