import type { ChecklistItem, Motion } from '../config/types'
import { useReadOnly } from './ReadOnly'

interface Props {
  idPrefix: string
  items: readonly ChecklistItem[]
  hiddenCount: number
  motion: Motion
  checks: Record<string, boolean>
  onToggle: (itemId: string, checked: boolean) => void
}

export function Checklist({ idPrefix, items, hiddenCount, motion, checks, onToggle }: Props) {
  const done = items.filter(i => checks[i.id]).length
  const readOnly = useReadOnly()
  return (
    <div>
      <p className="mb-2 text-sm text-ink-muted">
        {done} of {items.length} done
        {hiddenCount > 0 && <> — {hiddenCount} item{hiddenCount === 1 ? '' : 's'} hidden because {hiddenCount === 1 ? 'it doesn’t' : 'they don’t'} apply to a {motion} motion</>}
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line bg-sheet">
        {items.map(item => {
          const id = `${idPrefix}-${item.id}`
          const checked = !!checks[item.id]
          return (
            <li key={item.id}>
              <label htmlFor={id} className="flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-paper">
                <input id={id} type="checkbox" checked={checked} disabled={readOnly} onChange={e => onToggle(item.id, e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-ready)]" />
                <span>
                  <span className={`block ${checked ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink'}`}>{item.label}</span>
                  <span className="block text-sm text-ink-muted">{item.evidence}. Suggested owner: {item.owner}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
