// What the app needs from a backend. The Supabase implementation is used in
// production; the in-memory one runs the app without a database (tests, demo).
import type { Project } from '../config/types'
import type { WorkspaceRole } from '../lib/database.types'
import type { SaveResult, StoredProject } from '../lib/projectsRepo'

export type { SaveResult, StoredProject, WorkspaceRole }

export interface User { id: string; email: string }
export interface Workspace { id: string; name: string; role: WorkspaceRole }
export interface Member { userId: string; email: string; role: WorkspaceRole }
export interface Invite { id: string; email: string; role: 'editor' | 'viewer'; createdAt: string }

export interface AuthService {
  getUser(): Promise<User | null>
  /** Returns an unsubscribe function. */
  onChange(cb: (user: User | null) => void): () => void
  sendMagicLink(email: string): Promise<void>
  signOut(): Promise<void>
}

export interface ProjectListResult {
  projects: StoredProject[]
  /** Rows that exist but could not be read (invalid data). */
  unreadable: { id: string; name: string }[]
}

export interface StoreService {
  listWorkspaces(): Promise<Workspace[]>
  renameWorkspace(id: string, name: string): Promise<void>
  /** Accept invites sent to the signed-in user's email. Returns how many were accepted. */
  acceptInvites(): Promise<number>

  listProjects(workspaceId: string, includeArchived: boolean): Promise<ProjectListResult>
  getProject(id: string): Promise<StoredProject | null>
  createProject(workspaceId: string, project: Pick<Project, 'name' | 'data'>, action?: string): Promise<StoredProject>
  saveProject(project: Pick<Project, 'id' | 'name' | 'data'>, expectedVersion: number): Promise<SaveResult>
  renameProject(id: string, name: string, expectedVersion: number): Promise<SaveResult>
  setArchived(id: string, archived: boolean): Promise<void>
  deleteProject(id: string): Promise<void>

  listMembers(workspaceId: string): Promise<Member[]>
  listInvites(workspaceId: string): Promise<Invite[]>
  invite(workspaceId: string, email: string, role: 'editor' | 'viewer'): Promise<void>
  revokeInvite(inviteId: string): Promise<void>
  setRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>
  removeMember(workspaceId: string, userId: string): Promise<void>
}

export interface Services {
  auth: AuthService
  store: StoreService
  /** 'supabase' saves to the database; 'memory' keeps everything in this tab. */
  mode: 'supabase' | 'memory'
}

/** Turn backend errors into sentences a user can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/rate limit|too many|429/i.test(msg)) return 'Too many sign-in emails were sent recently. Wait a few minutes and try again.'
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg)) return 'Can’t reach the server. Check your connection and try again.'
  if (/row-level security|permission denied|42501/i.test(msg)) return 'You don’t have permission to do that in this workspace.'
  if (/at least one owner/i.test(msg)) return 'A workspace must keep at least one owner. Make someone else an owner first.'
  if (/duplicate key|already exists|23505/i.test(msg)) return 'That already exists.'
  return msg
}
