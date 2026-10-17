import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'
import type { SectionState } from '../engine/progress'

export const STATE_LABEL: Record<SectionState, string> = { not_started: 'Not started', in_progress: 'In progress', ready: 'Ready' }
export const stateLabel = (s: SectionState) => STATE_LABEL[s]

export function launchCountdown(launchDate: string, today: Date): { value: string; caption: string } | null {
  const d = parseISO(launchDate)
  if (!launchDate || !isValid(d)) return null
  const days = differenceInCalendarDays(d, today)
  if (days === 0) return { value: 'T−0', caption: 'Launch day' }
  return days > 0
    ? { value: `T−${days}`, caption: `day${days === 1 ? '' : 's'} to launch` }
    : { value: `T+${-days}`, caption: `day${days === -1 ? '' : 's'} since launch` }
}
