// Saves a project shortly after the user stops typing. Each save carries the
// version it was based on; if someone else saved in between, the save is
// refused and the user chooses to load their version or keep their own.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '../config/types'
import type { SaveResult, StoredProject } from '../lib/projectsRepo'

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict' | 'readonly'

interface Options {
  project: Project
  initialVersion: number
  save: (p: Pick<Project, 'id' | 'name' | 'data'>, expectedVersion: number) => Promise<SaveResult>
  /** Called to replace local state with the stored version (conflict → reload). */
  onReplace: (p: StoredProject) => void
  readOnly?: boolean
  delayMs?: number
}

export interface Autosave {
  state: SaveState
  error: string | null
  lastSavedAt: Date | null
  conflict: StoredProject | null
  saveNow: () => void
  /** Discard local changes and load the other person's version. */
  reloadTheirs: () => void
  /** Save local changes on top of the other person's version. */
  keepMine: () => void
}

export function useAutosave({ project, initialVersion, save, onReplace, readOnly = false, delayMs = 800 }: Options): Autosave {
  const [state, setState] = useState<SaveState>(readOnly ? 'readonly' : 'saved')
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [conflict, setConflict] = useState<StoredProject | null>(null)

  const version = useRef(initialVersion)
  const latest = useRef(project)
  const persisted = useRef<Project>(project)
  const inFlight = useRef(false)
  const queued = useRef(false)
  const blocked = useRef(false) // true while a conflict is unresolved
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save; latest.current = project })

  const flush = useCallback(async () => {
    if (readOnly || blocked.current) return
    if (inFlight.current) { queued.current = true; return }
    const snapshot = latest.current
    if (snapshot === persisted.current) { setState('saved'); return }
    inFlight.current = true
    setState('saving')
    try {
      const r = await saveRef.current({ id: snapshot.id, name: snapshot.name, data: snapshot.data }, version.current)
      if (r.ok) {
        version.current = r.project.version
        persisted.current = snapshot
        setError(null)
        setLastSavedAt(new Date())
        setState(latest.current === snapshot ? 'saved' : 'unsaved')
      } else {
        blocked.current = true
        setConflict(r.latest)
        setState('conflict')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState('error')
    } finally {
      inFlight.current = false
      if (queued.current && !blocked.current) { queued.current = false; void flush() }
    }
  }, [readOnly])

  // Debounce: save `delayMs` after the last change.
  useEffect(() => {
    if (readOnly || blocked.current || project === persisted.current) return
    setState(s => (s === 'saving' ? s : 'unsaved'))
    const t = setTimeout(() => { void flush() }, delayMs)
    return () => clearTimeout(t)
  }, [project, readOnly, delayMs, flush])

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (state !== 'unsaved' && state !== 'saving' && state !== 'error' && state !== 'conflict') return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state])

  const reloadTheirs = useCallback(() => {
    if (!conflict) return
    version.current = conflict.version
    persisted.current = conflict
    latest.current = conflict
    blocked.current = false
    setConflict(null)
    setState('saved')
    onReplace(conflict)
  }, [conflict, onReplace])

  const keepMine = useCallback(() => {
    if (!conflict) return
    version.current = conflict.version
    blocked.current = false
    setConflict(null)
    void flush()
  }, [conflict, flush])

  const saveNow = useCallback(() => { void flush() }, [flush])

  return { state, error, lastSavedAt, conflict, saveNow, reloadTheirs, keepMine }
}
