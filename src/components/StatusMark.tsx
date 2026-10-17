import type { SectionState } from '../engine/progress'

import { STATE_LABEL as LABEL } from './labels'

/** Ring that fills as a section moves from not started → in progress → ready. */
export function StatusMark({ state, onDark = false, size = 14 }: { state: SectionState; onDark?: boolean; size?: number }) {
  const idle = onDark ? 'rgba(255,255,255,.45)' : 'var(--color-idle)'
  return (
    <span className="inline-flex shrink-0" title={LABEL[state]}>
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        {state === 'ready' ? (
          <>
            <circle cx="8" cy="8" r="7" fill="var(--color-ready)" stroke={onDark ? '#4FB3A2' : 'var(--color-ready)'} strokeWidth="1.5" />
            <path d="M4.8 8.2 7 10.3l4.2-4.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : state === 'in_progress' ? (
          <>
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--color-signal)" strokeWidth="1.5" />
            <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="var(--color-signal)" />
          </>
        ) : (
          <circle cx="8" cy="8" r="6.25" fill="none" stroke={idle} strokeWidth="1.5" />
        )}
      </svg>
      <span className="sr-only">{LABEL[state]}</span>
    </span>
  )
}

