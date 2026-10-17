import { useCallback, useEffect, useState } from 'react'
import type { Invite, Member, Services, User, Workspace, WorkspaceRole } from '../services/types'
import { friendlyError } from '../services/types'

const ROLE_HELP: Record<WorkspaceRole, string> = {
  owner: 'Everything, including deleting plans and managing the team',
  editor: 'Create and edit plans',
  viewer: 'Read plans only',
}

interface Props { services: Services; workspace: Workspace; user: User; onWorkspaceChanged: () => void }

export function TeamPage({ services, workspace, user, onWorkspaceChanged }: Props) {
  const { store } = services
  const isOwner = workspace.role === 'owner'
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')

  const load = useCallback(async () => {
    try {
      setMembers(await store.listMembers(workspace.id))
      setInvites(isOwner ? await store.listInvites(workspace.id) : [])
    } catch (e) { setError(friendlyError(e)) }
  }, [store, workspace.id, isOwner])
  useEffect(() => { void load() }, [load])

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setError(null); setMessage(null)
    try { await fn(); await load(); if (done) setMessage(done) } catch (e) { setError(friendlyError(e)) }
  }

  const sendInvite = (e: React.FormEvent) => {
    e.preventDefault()
    const to = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { setError('Enter a full email address.'); return }
    if (members?.some(m => m.email === to)) { setError(`${to} is already in this workspace.`); return }
    void act(async () => { await store.invite(workspace.id, to, role); setEmail('') },
      `Invited ${to} as ${role}. Ask them to sign in at this app’s address with that email; they’ll join automatically.`)
  }

  return (
    <div className="max-w-3xl">
      <h1 className="m-0 text-3xl font-bold tracking-tight text-ink">Team</h1>
      <WorkspaceName services={services} workspace={workspace} onSaved={onWorkspaceChanged} />

      {error && <p role="alert" className="mb-6 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
      {message && <p role="status" className="mb-6 rounded-md bg-ready-soft px-3 py-2 text-sm text-ink">{message}</p>}

      <section aria-labelledby="members-title" className="mb-10">
        <h2 id="members-title" className="m-0 mb-3 text-lg font-bold text-ink">Members</h2>
        {members === null ? <p className="text-ink-muted">Loading…</p> : (
          <ul className="m-0 list-none divide-y divide-line rounded-lg border border-line bg-sheet p-0">
            {members.map(m => {
              const me = m.userId === user.id
              return (
                <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="m-0 truncate font-semibold text-ink">{m.email || 'Unknown user'}{me && <span className="font-normal text-ink-muted"> (you)</span>}</p>
                    <p className="m-0 text-sm text-ink-muted">{ROLE_HELP[m.role]}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {isOwner ? (
                      <select aria-label={`Role for ${m.email}`} value={m.role} className="field-control w-auto py-1"
                        onChange={e => void act(() => store.setRole(workspace.id, m.userId, e.target.value as WorkspaceRole), `${m.email} is now ${e.target.value}.`)}>
                        <option value="owner">Owner</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
                      </select>
                    ) : <span className="capitalize text-ink-soft">{m.role}</span>}
                    {(isOwner && !me) && (
                      <button type="button" className="text-alert underline underline-offset-2"
                        onClick={() => { if (confirm(`Remove ${m.email} from ${workspace.name}?`)) void act(() => store.removeMember(workspace.id, m.userId), `${m.email} removed.`) }}>Remove</button>
                    )}
                    {me && !isOwner && (
                      <button type="button" className="text-alert underline underline-offset-2"
                        onClick={() => { if (confirm(`Leave ${workspace.name}? You’ll lose access to its plans.`)) void act(async () => { await store.removeMember(workspace.id, m.userId); onWorkspaceChanged() }) }}>Leave workspace</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {isOwner ? (
        <section aria-labelledby="invite-title">
          <h2 id="invite-title" className="m-0 mb-3 text-lg font-bold text-ink">Invite someone</h2>
          <form onSubmit={sendInvite} className="grid gap-3 rounded-lg border border-line bg-sheet p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-sm font-semibold text-ink">Email</label>
              <input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="field-control" placeholder="teammate@company.com" />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-sm font-semibold text-ink">Role</label>
              <select id="invite-role" value={role} onChange={e => setRole(e.target.value as 'editor' | 'viewer')} className="field-control">
                <option value="editor">Editor</option><option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className="rounded-md bg-ink px-4 py-2.5 font-semibold text-white hover:bg-ink-soft">Send invite</button>
          </form>
          <p className="mt-2 text-sm text-ink-muted">The app doesn’t send an email for invites yet. Tell your teammate to sign in with this address; they’ll join this workspace automatically.</p>

          {invites.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-base font-bold text-ink">Waiting to join</h3>
              <ul className="m-0 list-none divide-y divide-line rounded-lg border border-line bg-sheet p-0">
                {invites.map(i => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span><b className="text-ink">{i.email}</b> <span className="text-ink-muted">as {i.role}</span></span>
                    <button type="button" className="text-alert underline underline-offset-2" onClick={() => void act(() => store.revokeInvite(i.id), `Invite for ${i.email} cancelled.`)}>Cancel invite</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : <p className="text-sm text-ink-muted">Only owners can invite people or change roles.</p>}
    </div>
  )
}

function WorkspaceName({ services, workspace, onSaved }: { services: Services; workspace: Workspace; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(workspace.name)
  if (workspace.role !== 'owner') return <p className="mb-8 mt-1 text-ink-soft">{workspace.name}</p>
  if (!editing) {
    return (
      <p className="mb-8 mt-1 text-ink-soft">
        {workspace.name} <button type="button" onClick={() => { setName(workspace.name); setEditing(true) }} className="ml-2 text-sm font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">Rename workspace</button>
      </p>
    )
  }
  return (
    <form className="mb-8 mt-2 flex flex-wrap items-end gap-2" onSubmit={async e => {
      e.preventDefault()
      if (!name.trim()) return
      await services.store.renameWorkspace(workspace.id, name.trim())
      setEditing(false); onSaved()
    }}>
      <div>
        <label htmlFor="ws-name" className="mb-1 block text-sm font-semibold text-ink">Workspace name</label>
        <input id="ws-name" value={name} onChange={e => setName(e.target.value)} className="field-control" />
      </div>
      <button type="submit" className="rounded-md bg-ink px-3 py-2 font-semibold text-white">Save name</button>
      <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-line bg-sheet px-3 py-2 text-ink">Cancel</button>
    </form>
  )
}
