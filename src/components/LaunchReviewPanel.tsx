import { format, parseISO } from 'date-fns'
import type { SectionId } from '../config/types'
import type { LaunchReview } from '../engine/launchReview'
import type { PlanView } from '../router'
import { LinkButton } from './Panels'

/** Shown at the top of the Go / no-go step: what still stands between the plan and a go decision. */
export function LaunchReviewPanel({ review, onNavigate }: { review: LaunchReview; onNavigate: (id: PlanView) => void }) {
  const ready = review.verdict === 'ready'
  return (
    <section aria-labelledby="review-title" className={`mb-8 rounded-lg border p-5 ${ready ? 'border-ready/40 bg-ready-soft' : 'border-signal/50 bg-signal-soft'}`}>
      <h2 id="review-title" className="m-0 text-lg font-bold text-ink">Readiness review</h2>
      <p className="mb-0 mt-1 text-ink">{review.headline}</p>

      <div className="mt-4 grid gap-5 md:grid-cols-3">
        <Column title="Steps before launch" empty="All ready." count={review.blockingSteps.length}>
          {review.blockingSteps.map(b => (
            <li key={b.sectionId}>
              <LinkButton onClick={() => onNavigate(b.sectionId as SectionId)}>{b.number} {b.title}</LinkButton>
              <span className="block text-ink-soft">{b.missing.join('; ')}</span>
            </li>
          ))}
        </Column>
        <Column title="Open high-impact risks" empty="None open." count={review.highRisks.length}>
          {review.highRisks.map(r => (
            <li key={r.rowId}>
              <span className="font-semibold text-ink">{r.risk}</span>
              <span className={`block ${r.unmitigated ? 'font-semibold text-alert' : 'text-ink-soft'}`}>
                {r.unmitigated ? 'No mitigation or owner yet' : `${r.status}, ${r.probability.toLowerCase()} likelihood, owner ${r.owner}`}
              </span>
            </li>
          ))}
          {review.highRisks.length > 0 && <li><LinkButton onClick={() => onNavigate('risks')}>Open the risk register</LinkButton></li>}
        </Column>
        <Column title="Overdue work" empty="Nothing overdue." count={review.overdue.length}>
          {review.overdue.slice(0, 6).map(t => (
            <li key={t.rowId}>
              <span className="font-semibold text-ink">{t.title || 'Untitled'}</span>
              <span className="block text-ink-soft">{t.sectionTitle}, due {format(parseISO(t.due), 'd MMM')}{t.owner ? `, ${t.owner}` : ''}</span>
            </li>
          ))}
          {review.overdue.length > 0 && <li><LinkButton onClick={() => onNavigate('tasks')}>{review.overdue.length > 6 ? `See all ${review.overdue.length} in Tasks` : 'Open Tasks'}</LinkButton></li>}
        </Column>
      </div>
    </section>
  )
}

function Column({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="m-0 mb-2 text-sm font-bold text-ink">{title} <span className="font-normal tabular-nums text-ink-muted">{count}</span></h3>
      {count === 0 ? <p className="m-0 text-sm text-ready">{empty}</p> : <ul className="m-0 list-none space-y-2 p-0 text-sm">{children}</ul>}
    </div>
  )
}
