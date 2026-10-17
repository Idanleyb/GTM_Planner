import type { Autosave } from '../state/useAutosave'
import { friendlyError } from '../services/types'

/** Small save indicator for the rail and the mobile header (dark background). */
export function SaveStatus({ autosave, mode }: { autosave: Autosave; mode: 'supabase' | 'memory' }) {
  const { state, error, lastSavedAt, saveNow } = autosave
  if (mode === 'memory') return <span className="text-white/70">Demo mode: changes aren’t saved</span>
  const time = lastSavedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dot = (color: string) => <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      {state === 'saved' && <>{dot('var(--color-ready)')}<span className="text-white/80">{time ? `Saved at ${time}` : 'All changes saved'}</span></>}
      {state === 'unsaved' && <>{dot('var(--color-signal)')}<span className="text-white/80">Unsaved changes</span></>}
      {state === 'saving' && <>{dot('var(--color-signal)')}<span className="text-white/80">Saving…</span></>}
      {state === 'readonly' && <span className="text-white/70">View only: you’re a viewer in this workspace</span>}
      {state === 'conflict' && <>{dot('var(--color-alert)')}<span className="text-white">Not saved: someone else changed this plan</span></>}
      {state === 'error' && (
        <>{dot('var(--color-alert)')}<span className="text-white" title={error ?? ''}>Not saved. {friendlyError(error ?? 'Unknown error')}</span>
          <button type="button" onClick={saveNow} className="font-semibold text-white underline decoration-signal decoration-2 underline-offset-2">Try again</button></>
      )}
    </span>
  )
}

/** Banner shown in the page when a save conflict needs a decision. */
export function ConflictBanner({ autosave }: { autosave: Autosave }) {
  if (autosave.state !== 'conflict') return null
  const theirs = autosave.conflict
  return (
    <div role="alert" className="mx-auto mb-6 max-w-5xl rounded-lg border border-alert/40 bg-alert-soft p-4 text-sm text-ink">
      <p className="m-0 font-semibold text-alert">Someone else saved this plan while you were editing</p>
      <p className="mb-3 mt-1">
        {theirs ? <>Their version was saved at {new Date(theirs.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. </> : <>The plan may have been deleted. </>}
        Choose which version to keep. Your recent edits are still on screen.
      </p>
      <div className="flex flex-wrap gap-2">
        {theirs && <button type="button" onClick={autosave.reloadTheirs} className="rounded-md border border-line bg-sheet px-3 py-2 font-semibold text-ink hover:border-ink-muted">Load their version</button>}
        {theirs && <button type="button" onClick={autosave.keepMine} className="rounded-md bg-ink px-3 py-2 font-semibold text-white hover:bg-ink-soft">Keep my version</button>}
      </div>
    </div>
  )
}
