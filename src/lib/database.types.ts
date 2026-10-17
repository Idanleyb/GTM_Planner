// Hand-written to match supabase/migrations/20261017120000_initial_schema.sql.
// Once the Supabase CLI is linked, replace with:
//   npx supabase gen types typescript --project-id qwjtocmtsbbnezmyxymd > src/lib/database.types.ts

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type WorkspaceRole = 'owner' | 'editor' | 'viewer'
type MotionDb = 'Sales-led' | 'Marketing-led' | 'PLG' | 'Partner-led' | 'Hybrid'

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[] }
type Table<Row, Insert, R extends Rel[] = []> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: R }

export type ProjectRow = {
  id: string
  workspace_id: string
  name: string
  motion: MotionDb
  launch_date: string | null
  schema_version: number
  data: Json
  version: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; email: string; display_name: string | null; created_at: string },
        { id: string; email: string; display_name?: string | null }
      >
      workspaces: Table<
        { id: string; name: string; created_by: string; created_at: string },
        { name: string; created_by?: string }
      >
      workspace_members: Table<
        { workspace_id: string; user_id: string; role: WorkspaceRole; created_at: string },
        { workspace_id: string; user_id: string; role: WorkspaceRole },
        [{ foreignKeyName: 'workspace_members_workspace_id_fkey'; columns: ['workspace_id']; isOneToOne: false; referencedRelation: 'workspaces'; referencedColumns: ['id'] }]
      >
      workspace_invites: Table<
        { id: string; workspace_id: string; email: string; role: 'editor' | 'viewer'; invited_by: string; created_at: string; accepted_at: string | null },
        { workspace_id: string; email: string; role: 'editor' | 'viewer' }
      >
      projects: Table<
        ProjectRow,
        { workspace_id: string; name: string; motion?: MotionDb; launch_date?: string | null; schema_version?: number; data: Json; archived_at?: string | null }
      >
      project_activity: Table<
        { id: number; project_id: string; user_id: string; action: string; summary: string | null; diff: Json | null; created_at: string },
        { project_id: string; action: string; summary?: string | null; diff?: Json | null }
      >
    }
    Views: Record<string, never>
    Functions: {
      accept_pending_invites: { Args: Record<PropertyKey, never>; Returns: number }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
