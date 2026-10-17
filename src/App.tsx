import { useEffect, useReducer, useState } from 'react'
import fixture from './test/fixtures/prototype-pimp-my-prompt.json'
import { SECTIONS, SECTION_BY_ID } from './config/sections'
import type { CellValue, Motion, Project, SectionId } from './config/types'
import type { FunnelModel } from './config/sections'
import { createProject, currentFunnelModel, isFunnelCustomized, migratePrototype, motionChangeImpact, projectProgress, setLaunchDate, unselectChannel } from './engine'
import { checkConnection } from './lib/connectionCheck'
import type { ConnectionState } from './lib/connectionCheck'
import { supabase } from './lib/supabase'
import { projectReducer } from './state/projectReducer'
import { MobileBar, Rail } from './components/Rail'
import { SectionView } from './components/SectionView'

// Until auth + autosave land (Steps 7–8), the app works on an in-memory project:
// the migrated Pimp My Prompt test plan, or a fresh empty one.
const sample = (): Project => migratePrototype(fixture).project
const sectionFromHash = (): SectionId => {
  const id = window.location.hash.replace(/^#\/?/, '') as SectionId
  return SECTION_BY_ID[id] ? id : SECTIONS[0].id
}

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, undefined, sample)
  const [current, setCurrent] = useState<SectionId>(sectionFromHash)
  const [conn, setConn] = useState<ConnectionState | null>(null)
  const [today] = useState(() => new Date())
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])
  const progress = projectProgress(project.data)

  useEffect(() => { checkConnection(supabase).then(setConn) }, [])
  useEffect(() => {
    const onHash = () => setCurrent(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (id: SectionId) => {
    setCurrent(id)
    if (window.location.hash !== `#/${id}`) window.history.pushState(null, '', `#/${id}`)
    window.scrollTo({ top: 0 })
    document.getElementById('main')?.focus({ preventScroll: true })
  }

  // Field edits that ripple into other sections (Step 6).
  const onField = (sectionId: SectionId, key: string, value: CellValue) => {
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
    if (on) { dispatch({ type: 'selectChannel', channel }); return }
    const { archived } = unselectChannel(project.data, channel)
    dispatch({ type: 'unselectChannel', channel })
    if (archived) setNotice(`${channel} archived with its details. Tick it again to restore.`)
  }

  const section = SECTION_BY_ID[current]
  const status = progress.sections.find(s => s.sectionId === current)!

  const footer = (
    <div className="space-y-3">
      <div>
        <label htmlFor="project-source" className="mb-1 block text-white/60">Working on</label>
        <select id="project-source" className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-white"
          value={project.id === 'new' ? 'new' : 'sample'}
          onChange={e => {
            const next = e.target.value === 'new' ? { ...createProject('New GTM project', 'Hybrid'), id: 'new' } : sample()
            if (confirm('Switch project? Changes to the current one are not saved yet.')) { dispatch({ type: 'replace', project: next }); navigate('brief') }
          }}>
          <option value="sample" className="text-ink">Pimp My Prompt test plan</option>
          <option value="new" className="text-ink">New empty project</option>
        </select>
      </div>
      <p className="m-0 text-white/55">
        Changes stay in this tab until saving to Supabase is added.{' '}
        {conn && <span className="block mt-1">Database: {conn.state === 'ready' ? 'connected' : conn.state === 'schema-missing' ? 'schema missing' : conn.state === 'not-configured' ? 'not configured' : 'unreachable'}</span>}
      </p>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-20 focus:rounded focus:bg-sheet focus:px-3 focus:py-2 focus:text-ink">Skip to content</a>
      <Rail project={project} progress={progress} current={current} today={today} onNavigate={navigate} footer={footer} />
      <div className="min-w-0 flex-1">
        <MobileBar project={project} progress={progress} current={current} today={today} onNavigate={navigate} />
        <main id="main" tabIndex={-1} className="px-4 py-6 outline-none sm:px-8 lg:px-12 lg:py-10">
          <SectionView key={current} section={section} status={status} project={project} dispatch={dispatch} onNavigate={navigate}
            onField={onField} onChannel={onChannel} onRecalculateRoadmap={() => { dispatch({ type: 'recalculateRoadmap' }); setNotice('All roadmap dates reset from the launch date.') }} today={today} />
        </main>
      </div>
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        {notice && <p className="pointer-events-auto m-0 max-w-xl rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">{notice}</p>}
      </div>
    </div>
  )
}
