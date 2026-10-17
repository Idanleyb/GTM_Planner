import { useCallback, useEffect, useState } from 'react'
import { useRoute } from './router'
import { defaultServices } from './services/defaultServices'
import type { Services, User, Workspace } from './services/types'
import { friendlyError } from './services/types'
import { AppShell } from './pages/AppShell'
import { ProjectLoader } from './pages/EditorPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SignInPage } from './pages/SignInPage'
import { TeamPage } from './pages/TeamPage'

const WS_KEY = 'gtm-planner.workspace'
const readWs = () => { try { return localStorage.getItem(WS_KEY) } catch { return null } }
const writeWs = (id: string) => { try { localStorage.setItem(WS_KEY, id) } catch { /* storage unavailable */ } }

export default function App({ services: provided }: { services?: Services }) {
  const [services] = useState<Services>(() => provided ?? defaultServices())
  const route = useRoute()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  // Workspaces are tagged with the user they were loaded for, so a sign-out never shows stale ones.
  const [loaded, setLoaded] = useState<{ userId: string; list: Workspace[] } | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(readWs)
  const [error, setError] = useState<string | null>(null)

  // Session: initial check + live updates (sign-in from the email link, sign-out, token refresh).
  useEffect(() => {
    let alive = true
    services.auth.getUser().then(u => { if (alive) setUser(u) }).catch(() => { if (alive) setUser(null) })
    const off = services.auth.onChange(u => setUser(u))
    return () => { alive = false; off() }
  }, [services])

  // Remove the one-time ?code= from the address bar after the email link signs the user in.
  useEffect(() => {
    if (user && window.location.search.includes('code=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
  }, [user])

  const userId = user?.id
  const loadWorkspaces = useCallback(async () => {
    if (!userId) return
    try {
      const list = await services.store.listWorkspaces()
      setLoaded({ userId, list })
      setError(null)
    } catch (e) { setError(friendlyError(e)) }
  }, [services, userId])

  useEffect(() => {
    if (!userId) return
    let alive = true
    ;(async () => {
      await services.store.acceptInvites().catch(() => 0)
      if (alive) await loadWorkspaces()
    })()
    return () => { alive = false }
  }, [userId, services, loadWorkspaces])
  const workspaces = loaded && loaded.userId === userId ? loaded.list : null

  const signOut = async () => {
    try { await services.auth.signOut() } finally { setUser(null); window.location.hash = '#/' }
  }

  if (user === undefined) return <Splash text="Loading…" />
  if (user === null) {
    return <SignInPage auth={services.auth} demo={services.mode === 'memory'}
      onDemo={services.mode === 'memory' ? () => void services.auth.sendMagicLink('demo@example.com') : undefined} />
  }
  if (error) return <Splash text={error} action={<button type="button" onClick={() => void loadWorkspaces()} className="mt-4 rounded-md bg-ink px-4 py-2.5 font-semibold text-white">Try again</button>} />
  if (!workspaces) return <Splash text="Loading your workspace…" />
  if (!workspaces.length) {
    return <Splash text="Your account isn’t in any workspace yet. If you were just invited, sign out and in again; otherwise ask the workspace owner to invite this email."
      action={<button type="button" onClick={() => void signOut()} className="mt-4 rounded-md bg-ink px-4 py-2.5 font-semibold text-white">Sign out</button>} />
  }

  const workspace = workspaces.find(w => w.id === workspaceId) ?? workspaces.find(w => w.role === 'owner') ?? workspaces[0]
  const chooseWorkspace = (id: string) => { setWorkspaceId(id); writeWs(id); window.location.hash = '#/' }

  if (route.name === 'project') {
    return <ProjectLoader key={route.id} services={services} projectId={route.id} section={route.section} user={user}
      workspaces={workspaces} onSignOut={() => void signOut()} />
  }

  return (
    <AppShell route={route} user={user} workspaces={workspaces} workspace={workspace} onWorkspace={chooseWorkspace}
      onSignOut={() => void signOut()} demo={services.mode === 'memory'}>
      {route.name === 'team'
        ? <TeamPage key={workspace.id} services={services} workspace={workspace} user={user} onWorkspaceChanged={() => void loadWorkspaces()} />
        : <ProjectsPage key={workspace.id} services={services} workspace={workspace} />}
    </AppShell>
  )
}

function Splash({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
      <div className="max-w-md">
        <p className="condensed m-0 text-3xl font-extrabold tracking-tight text-ink">GTM Planner</p>
        <p role="status" className="mt-3 text-ink-soft">{text}</p>
        {action}
      </div>
    </main>
  )
}
