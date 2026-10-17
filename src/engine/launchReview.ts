// The pre-launch picture for the go / no-go meeting: which earlier steps aren't
// ready, which high-impact risks are still open, and what work is overdue.
import { SECTIONS } from '../config/sections'
import { isDone } from '../config/types'
import type { ProjectData, SectionId } from '../config/types'
import { projectProgress } from './progress'
import { collectTasks } from './tasks'
import type { TaskItem } from './tasks'

export interface LaunchReview {
  verdict: 'ready' | 'not-ready'
  /** Steps before launch (Strategy, Plan, Readiness) that aren't ready, excluding Go / no-go itself. */
  blockingSteps: { sectionId: SectionId; title: string; number: string; missing: string[] }[]
  /** Open risks rated High impact. `unmitigated` when no mitigation or owner is recorded. */
  highRisks: { rowId: string; risk: string; probability: string; owner: string; status: string; unmitigated: boolean }[]
  overdue: TaskItem[]
  headline: string
}

const s = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

export function launchReview(data: ProjectData, today: Date = new Date()): LaunchReview {
  const progress = projectProgress(data)
  const preLaunch = SECTIONS.filter(x => x.phase !== 'run' && x.id !== 'launch')
  const blockingSteps = preLaunch
    .map(x => ({ def: x, st: progress.sections.find(p => p.sectionId === x.id)! }))
    .filter(({ st }) => st.state !== 'ready')
    .map(({ def, st }) => ({ sectionId: def.id, title: def.title, number: def.number, missing: st.missing }))

  const highRisks = (data.sections.risks.tables.rows ?? [])
    .filter(r => String(r.risk ?? '').trim() && String(r.impact) === 'High' && !isDone(r.status) && String(r.status) !== 'Accepted')
    .map(r => ({
      rowId: r.id, risk: String(r.risk), probability: String(r.probability ?? ''), owner: String(r.owner ?? ''), status: String(r.status ?? ''),
      unmitigated: !String(r.mitigation ?? '').trim() || !String(r.owner ?? '').trim(),
    }))

  const overdue = collectTasks(data, today).filter(t => t.overdue)
  const problems = [
    blockingSteps.length && `${s(blockingSteps.length, 'step')} not ready`,
    highRisks.filter(r => r.unmitigated).length && `${s(highRisks.filter(r => r.unmitigated).length, 'high-impact risk')} without a mitigation and owner`,
    overdue.length && `${s(overdue.length, 'task')} overdue`,
  ].filter(Boolean) as string[]

  return {
    verdict: problems.length ? 'not-ready' : 'ready',
    blockingSteps, highRisks, overdue,
    headline: problems.length
      ? `Not ready for a go decision yet: ${problems.join(', ')}.`
      : highRisks.length
        ? `Everything before launch is ready. ${s(highRisks.length, 'high-impact risk')} still open, each with a mitigation and owner.`
        : 'Everything before launch is ready. Record the decision below.',
  }
}
