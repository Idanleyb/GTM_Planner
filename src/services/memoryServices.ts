// In-memory backend with the same behaviour as Supabase that matters to the UI:
// versions and save conflicts, archive, roles. Used by tests and "demo mode".
import type { Project } from '../config/types'
import { newId } from '../engine/project'
import type { StoredProject } from '../lib/projectsRepo'
import type { AuthService, Invite, Member, Services, StoreService, User, Workspace } from './types'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export interface MemoryServices extends Services {
  /** Test helper: change a stored project as if another person saved it. */
  simulateRemoteEdit(id: string, edit: (p: StoredProject) => void): void
  /** Test helper: make the next N saves fail with a network error. */
  failNextSaves(n: number): void
}

export function memoryServices(opts: { user?: User | null; projects?: Project[]; workspaceName?: string } = {}): MemoryServices {
  let user: User | null = opts.user === undefined ? { id: 'demo-user', email: 'you@example.com' } : opts.user
  const listeners = new Set<(u: User | null) => void>()
  const ws: Workspace = { id: 'ws-demo', name: opts.workspaceName ?? 'My workspace', role: 'owner' }
  const projects = new Map<string, StoredProject>()
  const members: Member[] = user ? [{ userId: user.id, email: user.email, role: 'owner' }] : []
  const invites: Invite[] = []
  let failSaves = 0

  const put = (p: Project, version = 1): StoredProject => {
    const stored: StoredProject = { ...clone(p), workspaceId: ws.id, version, archivedAt: null }
    projects.set(stored.id, stored)
    return clone(stored)
  }
  for (const p of opts.projects ?? []) put(p)

  const auth: AuthService = {
    async getUser() { return user },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    async sendMagicLink(email) {
      // Demo: sign in immediately.
      user = { id: 'demo-user', email: email.trim().toLowerCase() }
      if (!members.length) members.push({ userId: user.id, email: user.email, role: 'owner' })
      listeners.forEach(l => l(user))
    },
    async signOut() { user = null; listeners.forEach(l => l(null)) },
  }

  const save = async (p: Pick<Project, 'id' | 'name' | 'data'>, expected: number) => {
    if (failSaves > 0) { failSaves--; throw new Error('Failed to fetch') }
    const cur = projects.get(p.id)
    if (!cur || cur.version !== expected) return { ok: false as const, reason: 'conflict' as const, latest: cur ? clone(cur) : null }
    const next: StoredProject = { ...cur, name: p.name, data: clone(p.data), version: cur.version + 1, updatedAt: new Date().toISOString() }
    projects.set(p.id, next)
    return { ok: true as const, project: clone(next) }
  }

  const store: StoreService = {
    async listWorkspaces() { return user ? [ws] : [] },
    async renameWorkspace(_id, name) { ws.name = name },
    async acceptInvites() { return 0 },
    async listProjects(_wsId, includeArchived) {
      const list = [...projects.values()].filter(p => includeArchived || !p.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return { projects: list.map(clone), unreadable: [] }
    },
    async getProject(id) { const p = projects.get(id); return p ? clone(p) : null },
    async createProject(_wsId, p) { return put({ ...(p as Project), id: newId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) },
    saveProject: save,
    async renameProject(id, name, expected) {
      const cur = projects.get(id)
      if (!cur) throw new Error('Project not found.')
      return save({ id, name, data: cur.data }, expected)
    },
    async setArchived(id, archived) {
      const cur = projects.get(id)
      if (cur) projects.set(id, { ...cur, archivedAt: archived ? new Date().toISOString() : null, version: cur.version + 1 })
    },
    async deleteProject(id) { projects.delete(id) },
    async listMembers() { return clone(members) },
    async listInvites() { return clone(invites) },
    async invite(_wsId, email, role) {
      const e = email.trim().toLowerCase()
      if (invites.some(i => i.email === e)) throw new Error('duplicate key value')
      invites.push({ id: newId(), email: e, role, createdAt: new Date().toISOString() })
    },
    async revokeInvite(id) { const i = invites.findIndex(x => x.id === id); if (i >= 0) invites.splice(i, 1) },
    async setRole(_wsId, userId, role) {
      const m = members.find(x => x.userId === userId)
      if (!m) return
      if (m.role === 'owner' && role !== 'owner' && members.filter(x => x.role === 'owner').length === 1) throw new Error('A workspace must keep at least one owner')
      m.role = role
    },
    async removeMember(_wsId, userId) {
      const m = members.find(x => x.userId === userId)
      if (m?.role === 'owner' && members.filter(x => x.role === 'owner').length === 1) throw new Error('A workspace must keep at least one owner')
      const i = members.findIndex(x => x.userId === userId); if (i >= 0) members.splice(i, 1)
    },
  }

  return {
    auth, store, mode: 'memory',
    simulateRemoteEdit(id, edit) {
      const cur = projects.get(id)
      if (!cur) return
      const next = clone(cur); edit(next); next.version = cur.version + 1
      projects.set(id, next)
    },
    failNextSaves(n) { failSaves = n },
  }
}
