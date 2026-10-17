import { CHANNEL_CATALOG } from '../config/sections'
import type { Row } from '../config/types'
import { useReadOnly } from './ReadOnly'

interface Props {
  selected: Set<string>
  archived: Row[]
  onToggle: (channel: string, on: boolean) => void
}

/** Tick the channels you will use; each one gets a row in the execution matrix. */
export function ChannelPicker({ selected, archived, onToggle }: Props) {
  const archivedNames = archived.map(r => String(r.channel)).filter(Boolean)
  const readOnly = useReadOnly()
  return (
    <fieldset className="mb-8 rounded-lg border border-line bg-sheet p-4">
      <legend className="px-1 text-lg font-bold text-ink">Channels in this launch</legend>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {CHANNEL_CATALOG.map(c => {
          const id = `ch-${c.channel.replace(/\W+/g, '-').toLowerCase()}`
          const on = selected.has(c.channel.toLowerCase())
          return (
            <label key={c.channel} htmlFor={id} className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-paper">
              <input id={id} type="checkbox" checked={on} disabled={readOnly} onChange={e => onToggle(c.channel, e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-ink)]" />
              <span>
                <span className="block text-ink">{c.channel}</span>
                <span className="block text-sm text-ink-muted">{c.role}</span>
              </span>
            </label>
          )
        })}
      </div>
      {archivedNames.length > 0 && (
        <p className="mb-0 mt-3 text-sm text-ink-muted">
          Archived with their details: {archivedNames.join(', ')}. Tick a channel again to bring its row back.
        </p>
      )}
    </fieldset>
  )
}
