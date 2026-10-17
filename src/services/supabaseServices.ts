import type { WorkspaceRole } from '../lib/database.types'
import type { ProjectRow } from '../lib/database.types'
import {
  deleteProject, getProject, insertProject, listWorkspaces, logActivity, projectColumns, rowToProject, saveProject, setArchived,
} from '../lib/projectsRepo'
import type { DbClient } from '../lib/supabase'
import type { AuthService, Invite, Member, ProjectListResult, Services, StoreService, User } from './types'

const fail = (what: string, error: { message: string } | null | undefined): never => {
  throw new Error(`${what}: ${error?.message ?? 'unknown error'}`)
}

function toUser(u: { id: string; email?: string | null } | null | undefined): User | null {
  return u ? { id: u.id, email: u.email ?? '' } : null
}

export function supabaseAuth(db: DbClient): AuthService {
  return {
    async getUser() {
      const { data } = await db.auth.getSession()
      return toUser(data.session?.user)
    },
    onChange(cb) {
      const { data } = db.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async sendMagicLink(email) {
      const { error } = await db.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      const { error } = await db.auth.signOut()
      if (error) throw new Error(error.message)
    },
  }
}

export function supabaseStore(db: DbClient): StoreService {
  return {
    listWorkspaces: () => listWorkspaces(db),

    async renameWorkspace(id, name) {
      const { error } = await db.from('workspaces').update({ name: name.trim() }).eq('id', id)
      if (error) fail('Renaming workspace failed', error)
    },

    async acceptInvites() {
      const { data, error } = await db.rpc('accept_pending_invites')
      // The function may not exist if the second migration hasn't been run; don't block sign-in.
      if (error) { console.warn('accept_pending_invites:', error.message); return 0 }
      return (data as number) ?? 0
    },

    async listProjects(workspaceId, includeArchived): Promise<ProjectListResult> {
      let query = db.from('projects').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
      if (!includeArchived) query = query.is('archived_at', null)
      const { data, error } = await query
      if (error) fail('Loading projects failed', error)
      const result: ProjectListResult = { projects: [], unreadable: [] }
      for (const row of (data ?? []) as ProjectRow[]) {
        try { result.projects.push(rowToProject(row)) } catch { result.unreadable.push({ id: row.id, name: row.name }) }
      }
      return result
    },

    getProject: id => getProject(db, id),

    async createProject(workspaceId, project, action = 'create') {
      const stored = await insertProject(db, workspaceId, project)
      if (action !== 'create') await logActivity(db, stored.id, action, `${action === 'import' ? 'Imported' : 'Created'} "${stored.name}"`)
      return stored
    },

    saveProject: (project, expectedVersion) => saveProject(db, project, expectedVersion),

    async renameProject(id, name, expectedVersion) {
      const current = await getProject(db, id)
      if (!current) throw new Error('Project not found.')
      const r = await saveProject(db, { id, name, data: current.data }, expectedVersion)
      if (r.ok) await logActivity(db, id, 'rename', `Renamed to "${name}"`)
      return r
    },

    async setArchived(id, archived) {
      await setArchived(db, id, archived)
      await logActivity(db, id, archived ? 'archive' : 'restore')
    },

    deleteProject: id => deleteProject(db, id),

    async listMembers(workspaceId): Promise<Member[]> {
      const { data, error } = await db.from('workspace_members').select('user_id, role').eq('workspace_id', workspaceId)
      if (error) fail('Loading members failed', error)
      const ids = (data ?? []).map(m => m.user_id)
      const { data: profiles, error: pErr } = ids.length
        ? await db.from('profiles').select('id, email').in('id', ids)
        : { data: [], error: null }
      if (pErr) fail('Loading members failed', pErr)
      const email = new Map((profiles ?? []).map(p => [p.id, p.email]))
      return (data ?? []).map(m => ({ userId: m.user_id, role: m.role as WorkspaceRole, email: email.get(m.user_id) ?? '' }))
    },

    async listInvites(workspaceId): Promise<Invite[]> {
      const { data, error } = await db.from('workspace_invites')
        .select('id, email, role, created_at').eq('workspace_id', workspaceId).is('accepted_at', null).order('created_at')
      if (error) fail('Loading invites failed', error)
      return (data ?? []).map(i => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at }))
    },

    async invite(workspaceId, email, role) {
      const { error } = await db.from('workspace_invites').insert({ workspace_id: workspaceId, email: email.trim().toLowerCase(), role })
      if (error) fail('Sending the invite failed', error)
    },

    async revokeInvite(id) {
      const { error } = await db.from('workspace_invites').delete().eq('id', id)
      if (error) fail('Revoking the invite failed', error)
    },

    async setRole(workspaceId, userId, role) {
      const { error, count } = await db.from('workspace_members').update({ role }, { count: 'exact' }).eq('workspace_id', workspaceId).eq('user_id', userId)
      if (error) fail('Changing the role failed', error)
      if (count === 0) throw new Error('Only workspace owners can change roles.')
    },

    async removeMember(workspaceId, userId) {
      const { error, count } = await db.from('workspace_members').delete({ count: 'exact' }).eq('workspace_id', workspaceId).eq('user_id', userId)
      if (error) fail('Removing the member failed', error)
      if (count === 0) throw new Error('Only workspace owners can remove other members.')
    },
  }
}

export function supabaseServices(db: DbClient): Services {
  return { auth: supabaseAuth(db), store: supabaseStore(db), mode: 'supabase' }
}

// Kept for callers that only need the mapping helper.
export { projectColumns }
