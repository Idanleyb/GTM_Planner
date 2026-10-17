import { supabase } from '../lib/supabase'
import { memoryServices } from './memoryServices'
import { supabaseServices } from './supabaseServices'
import type { Services } from './types'

/** Supabase when configured; otherwise an in-memory demo with no account. */
export function defaultServices(): Services {
  return supabase ? supabaseServices(supabase) : memoryServices({ user: null, workspaceName: 'Demo workspace' })
}
