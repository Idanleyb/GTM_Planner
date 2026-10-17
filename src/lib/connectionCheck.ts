import type { DbClient } from './supabase'

export type ConnectionState =
  | { state: 'not-configured' }
  | { state: 'unreachable'; detail: string }
  | { state: 'schema-missing'; detail: string }
  | { state: 'ready'; detail: string }

/**
 * Probe the projects table as the current (usually anonymous) visitor.
 * "permission denied" is the healthy answer for anonymous users: the table exists and RLS/grants block them.
 */
export async function checkConnection(db: DbClient | null): Promise<ConnectionState> {
  if (!db) return { state: 'not-configured' }
  try {
    const { error } = await db.from('projects').select('id').limit(1)
    if (!error) return { state: 'ready', detail: 'Connected; projects table readable for this session.' }
    if (error.code === '42501') return { state: 'ready', detail: 'Connected; schema installed and anonymous access is blocked.' }
    if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message))
      return { state: 'schema-missing', detail: 'Connected, but the projects table is missing — run the migration in the SQL editor.' }
    return { state: 'unreachable', detail: error.message }
  } catch (e) {
    return { state: 'unreachable', detail: e instanceof Error ? e.message : String(e) }
  }
}
