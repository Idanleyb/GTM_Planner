import type { ReactNode } from 'react'
import type { Route } from '../router'
import type { User, Workspace } from '../services/types'

interface Props {
  route: Route
  user: User
  workspaces: Workspace[]
  workspace: Workspace
  onWorkspace: (id: string) => void
  onSignOut: () => void
  demo: boolean
  children: ReactNode
}

/** Top bar for the plans list and team pages. */
export function AppShell({ route, user, workspaces, workspace, onWorkspace, onSignOut, demo, children }: Props) {
  const tab = (href: string, label: string, active: boolean) => (
    <a href={href} aria-current={active ? 'page' : undefined}
      className={`border-b-2 px-1 pb-2 pt-1 ${active ? 'border-signal font-semibold text-white' : 'border-transparent text-white/70 hover:text-white'}`}>{label}</a>
  )
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-5 sm:px-8">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <p className="condensed m-0 pb-2 text-2xl font-extrabold tracking-tight">GTM Planner</p>
            <nav aria-label="Main" className="flex gap-5 text-sm">
              {tab('#/', 'Plans', route.name === 'projects')}
              {tab('#/team', 'Team', route.name === 'team')}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3 pb-2 text-sm">
            {workspaces.length > 1 ? (
              <>
                <label htmlFor="ws-switch" className="text-white/70">Workspace</label>
                <select id="ws-switch" value={workspace.id} onChange={e => onWorkspace(e.target.value)}
                  className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-white">
                  {workspaces.map(w => <option key={w.id} value={w.id} className="text-ink">{w.name}{w.role !== 'owner' ? ` (${w.role})` : ''}</option>)}
                </select>
              </>
            ) : <span className="text-white/70">{workspace.name}</span>}
            <span className="text-white/40" aria-hidden="true">|</span>
            <span className="max-w-[16rem] truncate text-white/70" title={user.email}>{user.email}</span>
            <button type="button" onClick={onSignOut} className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-signal">Sign out</button>
          </div>
        </div>
      </header>
      {demo && (
        <p className="m-0 bg-signal-soft px-4 py-2 text-center text-sm text-ink">
          Demo mode: Supabase isn’t configured, so plans live only in this tab and disappear on refresh.
        </p>
      )}
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-8">{children}</main>
    </div>
  )
}
