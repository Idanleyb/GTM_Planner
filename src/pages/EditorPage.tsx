import { useCallback, useEffect, useReducer, useState } from 'react'
import { SECTION_BY_ID } from '../config/sections'
import type { FunnelModel } from '../config/sections'
import type { CellValue, Motion, Project, SectionId } from '../config/types'
import {
  currentFunnelModel, isFunnelCustomized, motionChangeImpact, projectProgress, setLaunchDate, unselectChannel,
} from '../engine'
import { downloadProject } from '../lib/importExport'
import type { StoredProject } from '../lib/projectsRepo'
import { navigate } from '../router'
import type { PlanView } from '../router'
import { downloadSummaryDoc } from '../lib/downloadSummary'
import { SummaryView } from '../components/SummaryView'
import { TasksView } from '../components/TasksView'
import type { Services, User, Workspace, WorkspaceRole } from '../services/types'
import { friendlyError } from '../services/types'
import { projectReducer } from '../state/projectReducer'
import type { ProjectAction } from '../state/projectReducer'
import { useAutosave } from '../state/useAutosave'
import { MobileBar, Rail } from '../components/Rail'
import { ReadOnlyContext } from '../components/ReadOnly'
import { ConflictBanner, SaveStatus } from '../components/SaveStatus'
import { SectionView } from '../components/SectionView'

interface LoaderProps {
  services: Services
  projectId: string
  section: PlanView
  user: User
  /** The user's workspaces; the editor uses the role in the project's own workspace. */
  workspaces: Workspace[]
  onSignOut: () => void
}

/** Loads a project by id, then hands it to the editor. */
export function ProjectLoader({ services, projectId, workspaces, ...rest }: LoaderProps) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; project: StoredProject }>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    services.store.getProject(projectId)
      .then(p => { if (alive) setState(p ? { status: 'ready', project: p } : { status: 'missing' }) })
      .catch(e => { if (alive) setState({ status: 'error', message: friendlyError(e) }) })
    return () => { alive = false }
  }, [services, projectId])

  if (state.status === 'ready') {
    // Unknown workspace (e.g. just removed from it): view only; the database enforces this anyway.
    const role = workspaces.find(w => w.id === state.project.workspaceId)?.role ?? 'viewer'
    return <EditorPage key={state.project.id} services={services} initial={state.project} role={role} {...rest} />
  }
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      {state.status === 'loading' && <p className="text-ink-muted">Loading the plan…</p>}
      {state.status !== 'loading' && (
        <div>
          <h1 className="m-0 text-2xl font-bold text-ink">{state.status === 'missing' ? 'This plan isn’t available' : 'The plan couldn’t be loaded'}</h1>
          <p className="mt-2 max-w-md text-ink-soft">{state.status === 'missing' ? 'It may have been deleted, or it belongs to a workspace you’re not a member of.' : state.message}</p>
          <a href="#/" className="mt-4 inline-block rounded-md bg-ink px-4 py-2.5 font-semibold text-white">Back to all plans</a>
        </div>
      )}
    </main>
  )
}

interface EditorProps extends Omit<LoaderProps, 'projectId' | 'workspaces'> { initial: StoredProject; role: WorkspaceRole }

export function EditorPage({ services, initial, section: current, role, user, onSignOut }: EditorProps) {
  const [project, rawDispatch] = useReducer(projectReducer, initial as Project)
  const readOnly = role === 'viewer'
  const dispatch = useCallback((a: ProjectAction) => { if (!readOnly || a.type === 'replace') rawDispatch(a) }, [readOnly])
  const [today] = useState(() => new Date())
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const onReplace = useCallback((p: StoredProject) => { rawDispatch({ type: 'replace', project: p }); setNotice('Loaded the latest saved version.') }, [])
  const autosave = useAutosave({
    project, initialVersion: initial.version, readOnly, onReplace,
    save: services.store.saveProject,
  })
  const progress = projectProgress(project.data)

  const go = (id: PlanView) => {
    navigate({ name: 'project', id: project.id, section: id })
    window.scrollTo({ top: 0 })
    document.getElementById('main')?.focus({ preventScroll: true })
  }

  // Field edits that ripple into other sections (Step 6).
  const onField = (sectionId: SectionId, key: string, value: CellValue) => {
    if (readOnly) return
    const ref = `${sectionId}.${key}`
    if (ref === 'brief.motion') {
      const impact = motionChangeImpact(project.data, value as Motion)
      const replace = impact.modelChanges && (!impact.needsConfirm ||
        confirm(`Switch the funnel to ${impact.to} stages? Your edited stages and rates will be replaced.`))
      dispatch({ type: 'setMotion', motion: value as Motion, replaceFunnel: replace })
      if (impact.modelChanges) setNotice(replace ? `Funnel switched to ${impact.to} stages.` : `Kept your current funnel stages (${impact.from}).`)
      return
    }
    if (ref === 'brief.launchDate') {
      const r = setLaunchDate(project.data, String(value))
      dispatch({ type: 'setLaunchDate', date: String(value) })
      if (r.moved || r.kept) setNotice(`${r.moved} roadmap date${r.moved === 1 ? '' : 's'} moved with the launch date${r.kept ? `; ${r.kept} set by hand stayed put` : ''}.`)
      return
    }
    if (ref === 'funnel.model') {
      if (value === currentFunnelModel(project.data)) return
      if (isFunnelCustomized(project.data) && !confirm(`Replace your funnel stages with the ${value} template?`)) return
      dispatch({ type: 'setFunnelModel', model: value as FunnelModel })
      setNotice(`Funnel stages set to the ${value} template.`)
      return
    }
    dispatch({ type: 'setField', section: sectionId, key, value })
  }
  const onChannel = (channel: string, on: boolean) => {
    if (readOnly) return
    if (on) { dispatch({ type: 'selectChannel', channel }); return }
    const { archived } = unselectChannel(project.data, channel)
    dispatch({ type: 'unselectChannel', channel })
    if (archived) setNotice(`${channel} archived with its details. Tick it again to restore.`)
  }

  const section = current === 'summary' || current === 'tasks' ? null : SECTION_BY_ID[current]
  const status = section ? progress.sections.find(s => s.sectionId === section.id)! : null
  const saveStatus = <SaveStatus autosave={autosave} mode={services.mode} />

  const footer = (
    <div className="space-y-3">
      <a href="#/" className="block font-semibold text-white underline decoration-signal decoration-2 underline-offset-4">All plans</a>
      <div>{saveStatus}</div>
      <button type="button" onClick={() => void downloadSummaryDoc(project).catch(e => setNotice(`The Word file couldn’t be created: ${e instanceof Error ? e.message : e}`))} className="block text-white/70 underline underline-offset-2 hover:text-white">Download plan as Word doc</button>
      <button type="button" onClick={() => downloadProject(project)} className="block text-white/70 underline underline-offset-2 hover:text-white">Download data as JSON</button>
      <p className="m-0 truncate text-white/55" title={user.email}>{user.email} · <button type="button" onClick={onSignOut} className="underline underline-offset-2 hover:text-white">Sign out</button></p>
    </div>
  )

  return (
    <ReadOnlyContext.Provider value={readOnly}>
      <div className="flex min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-20 focus:rounded focus:bg-sheet focus:px-3 focus:py-2 focus:text-ink">Skip to content</a>
        <Rail project={project} progress={progress} current={current} today={today} onNavigate={go} footer={footer} />
        <div className="min-w-0 flex-1">
          <MobileBar project={project} progress={progress} current={current} today={today} onNavigate={go}
            status={<>{saveStatus}<a href="#/" className="font-semibold text-white underline underline-offset-2">All plans</a></>} />
          <main id="main" tabIndex={-1} className="px-4 py-6 outline-none sm:px-8 lg:px-12 lg:py-10">
            <ConflictBanner autosave={autosave} />
            {initial.archivedAt && (
              <p className="mx-auto mb-6 max-w-5xl rounded-md bg-paper px-3 py-2 text-sm text-ink-soft ring-1 ring-line">This plan is archived. Restore it from the plans list to show it there again.</p>
            )}
            {section && status ? (
              <SectionView key={current} section={section} status={status} project={project} dispatch={dispatch} onNavigate={go}
                onField={onField} onChannel={onChannel}
                onRecalculateRoadmap={() => { dispatch({ type: 'recalculateRoadmap' }); setNotice('All roadmap dates reset from the launch date.') }} today={today} />
            ) : current === 'tasks'
              ? <TasksView project={project} dispatch={dispatch} today={today} onNavigate={go} />
              : <SummaryView project={project} today={today} onNavigate={go} />}
          </main>
        </div>
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 print:hidden">
          {notice && <p className="pointer-events-auto m-0 max-w-xl rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">{notice}</p>}
        </div>
      </div>
    </ReadOnlyContext.Provider>
  )
}
