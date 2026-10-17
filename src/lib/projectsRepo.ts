// Data access for projects and workspaces. Every call runs as the signed-in user;
// Row Level Security in Supabase decides what they can read and write.
import type { Motion, Project } from '../config/types'
import { getRef, motionOf } from '../engine/project'
import type { ProjectRow, WorkspaceRole } from './database.types'
import { parseProjectData } from './projectData.schema'
import type { DbClient } from './supabase'

/** A project as stored, with the concurrency version needed to save it. */
export interface StoredProject extends Project {
  workspaceId: string
  version: number
  archivedAt: string | null
}

export interface ProjectSummary {
  id: string
  name: string
  motion: Motion
  launchDate: string | null
  updatedAt: string
  archivedAt: string | null
}

export type SaveResult =
  | { ok: true; project: StoredProject }
  | { ok: false; reason: 'conflict'; latest: StoredProject | null }

// ---------------------------------------------------------------- mapping

export function rowToProject(row: ProjectRow): StoredProject {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: parseProjectData(row.data),
    workspaceId: row.workspace_id,
    version: row.version,
    archivedAt: row.archived_at,
  }
}

/** Columns lifted out of the jsonb for listing and sorting. */
export function projectColumns(project: Pick<Project, 'name' | 'data'>) {
  const launch = String(getRef(project.data, 'brief.launchDate'))
  return {
    name: project.name.trim().slice(0, 200) || 'Untitled GTM project',
    motion: motionOf(project.data),
    launch_date: /^\d{4}-\d{2}-\d{2}$/.test(launch) ? launch : null,
    schema_version: project.data.schemaVersion,
    data: JSON.parse(JSON.stringify(project.data)),
  }
}

const fail = (what: string, error: { message: string } | null): never => {
  throw new Error(`${what} failed: ${error?.message ?? 'unknown error'}`)
}

// ---------------------------------------------------------------- workspaces

export async function listWorkspaces(db: DbClient): Promise<{ id: string; name: string; role: WorkspaceRole }[]> {
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await db
    .from('workspace_members')
    .select('role, workspaces ( id, name )')
    .eq('user_id', auth.user.id)
  if (error) fail('Loading workspaces', error)
  return (data ?? []).flatMap(r => {
    const ws = r.workspaces as { id: string; name: string } | null
    return ws ? [{ id: ws.id, name: ws.name, role: r.role }] : []
  })
}

// ---------------------------------------------------------------- projects

export async function listProjects(db: DbClient, workspaceId: string, opts: { includeArchived?: boolean } = {}): Promise<ProjectSummary[]> {
  let query = db.from('projects')
    .select('id, name, motion, launch_date, updated_at, archived_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
  if (!opts.includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query
  if (error) fail('Loading projects', error)
  return (data ?? []).map(r => ({ id: r.id, name: r.name, motion: r.motion, launchDate: r.launch_date, updatedAt: r.updated_at, archivedAt: r.archived_at }))
}

export async function getProject(db: DbClient, id: string): Promise<StoredProject | null> {
  const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) fail('Loading project', error)
  return data ? rowToProject(data as ProjectRow) : null
}

export async function insertProject(db: DbClient, workspaceId: string, project: Pick<Project, 'name' | 'data'>): Promise<StoredProject> {
  const { data, error } = await db.from('projects')
    .insert({ workspace_id: workspaceId, ...projectColumns(project) })
    .select('*').single()
  if (error || !data) fail('Creating project', error)
  const stored = rowToProject(data as ProjectRow)
  await logActivity(db, stored.id, 'create', `Created "${stored.name}"`)
  return stored
}

/**
 * Save only if nobody else saved since `expectedVersion` was loaded.
 * On conflict, returns the latest stored version so the UI can merge or reload.
 */
export async function saveProject(db: DbClient, project: Pick<Project, 'id' | 'name' | 'data'>, expectedVersion: number): Promise<SaveResult> {
  const { data, error } = await db.from('projects')
    .update(projectColumns(project))
    .eq('id', project.id)
    .eq('version', expectedVersion)
    .select('*')
  if (error) fail('Saving project', error)
  if (data && data.length === 1) return { ok: true, project: rowToProject(data[0] as ProjectRow) }
  return { ok: false, reason: 'conflict', latest: await getProject(db, project.id) }
}

export async function setArchived(db: DbClient, id: string, archived: boolean): Promise<void> {
  const { error } = await db.from('projects').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)
  if (error) fail(archived ? 'Archiving project' : 'Restoring project', error)
}

export async function deleteProject(db: DbClient, id: string): Promise<void> {
  const { error, count } = await db.from('projects').delete({ count: 'exact' }).eq('id', id)
  if (error) fail('Deleting project', error)
  if (count === 0) throw new Error('Deleting project failed: only workspace owners can delete projects.')
}

export async function logActivity(db: DbClient, projectId: string, action: string, summary?: string, diff?: unknown): Promise<void> {
  const { error } = await db.from('project_activity').insert({
    project_id: projectId, action, summary: summary ?? null, diff: diff === undefined ? null : JSON.parse(JSON.stringify(diff)),
  })
  // Activity is best-effort: never block a save because the log write failed.
  if (error) console.warn('Activity log write failed:', error.message)
}
