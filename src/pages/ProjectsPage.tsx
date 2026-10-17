import { formatDistanceToNow } from 'date-fns'
import { useCallback, useEffect, useRef, useState } from 'react'
import fixture from '../test/fixtures/prototype-pimp-my-prompt.json'
import { MOTIONS } from '../config/types'
import type { Motion } from '../config/types'
import { createProjectData, migratePrototype, motionOf, projectProgress } from '../engine'
import { downloadProject, parseImport } from '../lib/importExport'
import { downloadSummaryDoc } from '../lib/downloadSummary'
import type { StoredProject } from '../lib/projectsRepo'
import { navigate } from '../router'
import type { Services, Workspace } from '../services/types'
import { friendlyError } from '../services/types'
import { launchCountdown } from '../components/labels'

interface Props { services: Services; workspace: Workspace }

export function ProjectsPage({ services, workspace }: Props) {
  const [today] = useState(() => new Date())
  const { store } = services
  const canEdit = workspace.role !== 'viewer'
  const [list, setList] = useState<StoredProject[] | null>(null)
  const [unreadable, setUnreadable] = useState<{ id: string; name: string }[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [motion, setMotion] = useState<Motion>('Hybrid')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await store.listProjects(workspace.id, showArchived)
      setList(r.projects); setUnreadable(r.unreadable); setError(null)
    } catch (e) { setError(friendlyError(e)) }
  }, [store, workspace.id, showArchived])
  useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setMessage(null)
    try { await fn() } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  }

  const createBlank = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const data = createProjectData(motion)
      const n = name.trim()
      if (n) data.sections.brief.fields.product = n
      const p = await store.createProject(workspace.id, { name: n || 'New GTM project', data })
      navigate({ name: 'project', id: p.id, section: 'brief' })
    })
  }
  const createExample = () => run(async () => {
    const { project } = migratePrototype(fixture)
    const p = await store.createProject(workspace.id, { name: project.name, data: project.data }, 'import')
    navigate({ name: 'project', id: p.id, section: 'brief' })
  })
  const importFile = (file: File) => run(async () => {
    const r = parseImport(await file.text())
    const p = await store.createProject(workspace.id, { name: r.name, data: r.data }, 'import')
    await load()
    setMessage(`Imported “${p.name}”.${r.warnings.length ? ` ${r.warnings.length} note${r.warnings.length === 1 ? '' : 's'} to review: ${r.warnings.join(' ')}` : ''}`)
  })

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-tight text-ink">Plans</h1>
          <p className="mb-0 mt-1 text-ink-soft">{workspace.name}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Show archived plans
        </label>
      </div>

      {canEdit && (
        <section aria-labelledby="new-plan" className="mb-8 rounded-lg border border-line bg-sheet p-5">
          <h2 id="new-plan" className="m-0 text-lg font-bold text-ink">Start a plan</h2>
          <form onSubmit={createBlank} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label htmlFor="new-name" className="mb-1 block text-sm font-semibold text-ink">Product or offer you’re launching</label>
              <input id="new-name" value={name} onChange={e => setName(e.target.value)} className="field-control" placeholder="e.g. BandMate Guitar for teachers" />
            </div>
            <div>
              <label htmlFor="new-motion" className="mb-1 block text-sm font-semibold text-ink">GTM motion</label>
              <select id="new-motion" value={motion} onChange={e => setMotion(e.target.value as Motion)} className="field-control">
                {MOTIONS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <button type="submit" disabled={busy} className="rounded-md bg-ink px-4 py-2.5 font-semibold text-white hover:bg-ink-soft disabled:opacity-60">Create plan</button>
          </form>
          <p className="mb-0 mt-4 text-sm text-ink-soft">
            Or <button type="button" disabled={busy} onClick={createExample} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">start from the example plan</button> (Pimp My Prompt launch, filled in),
            or <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">import a JSON file</button> from this app or the original prototype.
          </p>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Import a JSON file"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f) }} />
        </section>
      )}

      {error && <p role="alert" className="mb-6 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
      {message && <p role="status" className="mb-6 rounded-md bg-ready-soft px-3 py-2 text-sm text-ink">{message}</p>}
      {unreadable.length > 0 && (
        <p className="mb-6 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">
          {unreadable.length} plan{unreadable.length === 1 ? '' : 's'} couldn’t be read: {unreadable.map(u => u.name).join(', ')}.
        </p>
      )}

      {list === null && !error && <p className="text-ink-muted">Loading plans…</p>}
      {list?.length === 0 && (
        <p className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-ink-soft">
          {showArchived ? 'No plans here yet.' : canEdit ? 'No plans yet. Start one above, or open the example plan to look around.' : 'No plans in this workspace yet.'}
        </p>
      )}
      {list && list.length > 0 && (
        <ul className="m-0 list-none divide-y divide-line rounded-lg border border-line bg-sheet p-0">
          {list.map(p => <PlanRow key={p.id} p={p} today={today} services={services} workspace={workspace} onChanged={load} onError={setError} />)}
        </ul>
      )}
    </div>
  )
}

function PlanRow({ p, today, services, workspace, onChanged, onError }: {
  p: StoredProject; today: Date; services: Services; workspace: Workspace; onChanged: () => Promise<void>; onError: (m: string) => void
}) {
  const prog = projectProgress(p.data)
  const cd = launchCountdown(String(p.data.sections.brief.fields.launchDate ?? ''), today)
  const canEdit = workspace.role !== 'viewer'
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await onChanged() } catch (e) { onError(friendlyError(e)) } }
  const href = `#/p/${encodeURIComponent(p.id)}/brief`
  return (
    <li className={`grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 px-4 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center ${p.archivedAt ? 'opacity-70' : ''}`}>
      <div className="row-span-2 sm:row-span-1">
        {cd ? (
          <>
            <span className="condensed block text-4xl font-extrabold leading-none tracking-tight text-ink tabular-nums">{cd.value}</span>
            <span className="block text-xs text-ink-muted">{cd.caption}</span>
          </>
        ) : <span className="block text-sm text-ink-muted">No launch date</span>}
      </div>
      <div className="min-w-0">
        <a href={href} className="text-lg font-semibold text-ink underline-offset-4 hover:underline">{p.name}</a>
        <p className="m-0 mt-0.5 text-sm text-ink-muted">
          {motionOf(p.data)}{p.archivedAt ? ', archived' : ''}. Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-paper ring-1 ring-line" aria-hidden="true">
            <div className="h-full rounded-full bg-signal" style={{ width: `${prog.overall.pct}%` }} />
          </div>
          <span className="text-sm text-ink-soft">{prog.overall.pct}% complete, {prog.sectionsReady.done} of {prog.sectionsReady.total} steps ready</span>
        </div>
      </div>
      <div className="col-start-2 flex flex-wrap gap-x-4 gap-y-1 text-sm sm:col-start-auto sm:justify-end">
        <a href={href} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">Open</a>
        <a href={`#/p/${encodeURIComponent(p.id)}/summary`} className="text-ink-soft underline underline-offset-2 hover:text-ink">Summary</a>
        <button type="button" onClick={() => void downloadSummaryDoc(p, today).catch(e => onError(friendlyError(e)))} className="text-ink-soft underline underline-offset-2 hover:text-ink">Word doc</button>
        <button type="button" onClick={() => downloadProject(p)} className="text-ink-soft underline underline-offset-2 hover:text-ink">JSON</button>
        {canEdit && (
          <button type="button" className="text-ink-soft underline underline-offset-2 hover:text-ink" onClick={() => {
            const n = prompt('Rename plan', p.name)?.trim()
            if (n && n !== p.name) void act(async () => {
              const r = await services.store.renameProject(p.id, n, p.version)
              if (!r.ok) throw new Error('Someone else just changed this plan. Reload the page and try again.')
            })
          }}>Rename</button>
        )}
        {canEdit && (
          <button type="button" className="text-ink-soft underline underline-offset-2 hover:text-ink" onClick={() => void act(() => services.store.setArchived(p.id, !p.archivedAt))}>
            {p.archivedAt ? 'Restore' : 'Archive'}
          </button>
        )}
        {workspace.role === 'owner' && (
          <button type="button" className="text-alert underline underline-offset-2" onClick={() => {
            if (confirm(`Delete “${p.name}” for everyone in ${workspace.name}? This can’t be undone. Download it first if you want a copy.`)) void act(() => services.store.deleteProject(p.id))
          }}>Delete</button>
        )}
      </div>
    </li>
  )
}
