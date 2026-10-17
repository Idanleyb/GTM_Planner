import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type DbClient = SupabaseClient<Database>

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

/** Null when env vars are missing (e.g. tests, or a fresh clone without .env.local). */
export const supabase: DbClient | null = isSupabaseConfigured
  ? createClient<Database>(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null

export function requireSupabase(): DbClient {
  if (!supabase) throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).')
  return supabase
}
