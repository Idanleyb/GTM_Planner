// Calculated panels shown inside sections: funnel model, budget rollup, roadmap warnings.
import type { BudgetSummary } from '../engine/budget'
import type { FunnelResult } from '../engine/funnel'
import type { RoadmapWarning } from '../engine/roadmap'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const money = (n: number, cur: string) => `${cur ? cur + ' ' : ''}${fmt(n)}`

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={`m-0 text-xl font-bold tabular-nums ${tone === 'alert' ? 'text-alert' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}

export function FunnelPanel({ result, currency }: { result: FunnelResult; currency: string }) {
  if (!result.valid) {
    return (
      <div role="status" className="rounded-lg border border-alert/30 bg-alert-soft p-4 text-sm text-alert">
        <p className="m-0 font-semibold">The funnel can’t be calculated yet</p>
        <ul className="mb-0 mt-1 list-disc pl-5">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>
      </div>
    )
  }
  const top = result.volumes[0]?.required || 1
  return (
    <div className="rounded-lg border border-line bg-sheet p-4">
      <h3 className="m-0 mb-3 text-base font-bold text-ink">What it takes to hit the target</h3>
      <ol className="m-0 mb-4 list-none space-y-1.5 p-0">
        {result.volumes.map(v => (
          <li key={v.stage} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-ink">{v.stage}</span>
            <span className="h-2.5 rounded-full bg-paper" aria-hidden="true">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(2, (v.required / top) * 100)}%` }} />
            </span>
            <span className="tabular-nums font-semibold text-ink">{fmt(v.required)}</span>
          </li>
        ))}
      </ol>
      <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Figure label="First-stage spend" value={money(result.firstStageSpend, currency)} />
        <Figure label="CAC" value={result.cac === null ? '—' : money(result.cac, currency)} />
        <Figure label="First-year revenue" value={money(result.revenue, currency)} />
        <Figure label="Gross profit" value={money(result.grossProfit, currency)} />
        <Figure label="LTV : CAC" value={result.ltvToCac === null ? '—' : `${result.ltvToCac.toFixed(1)} : 1`} tone={result.ltvToCac !== null && result.ltvToCac < 1 ? 'alert' : undefined} />
      </dl>
    </div>
  )
}

export function BudgetPanel({ summary, currency, onOpenBrief }: { summary: BudgetSummary; currency: string; onOpenBrief: () => void }) {
  const gap = summary.gapToBrief ?? 0
  const message =
    summary.status === 'no-brief-budget' ? <>No total budget in the brief yet. <LinkButton onClick={onOpenBrief}>Add it in the GTM brief</LinkButton></>
    : summary.status === 'matches' ? <>The plan matches the brief budget of {money(summary.briefBudget!, currency)}.</>
    : summary.status === 'over-plan' ? <>The plan is <b>{money(gap, currency)} over</b> the brief budget of {money(summary.briefBudget!, currency)}. Cut lines or update the brief.</>
    : <>{money(-gap, currency)} of the brief budget ({money(summary.briefBudget!, currency)}) is not allocated yet.</>
  return (
    <div className="rounded-lg border border-line bg-sheet p-4">
      <dl className="m-0 grid grid-cols-3 gap-4">
        <Figure label="Planned" value={money(summary.planned, currency)} />
        <Figure label="Spent" value={money(summary.actual, currency)} />
        <Figure label="Remaining" value={money(summary.remaining, currency)} tone={summary.remaining < 0 ? 'alert' : undefined} />
      </dl>
      <p className={`mb-0 mt-3 text-sm ${summary.status === 'over-plan' ? 'text-alert' : 'text-ink-soft'}`}>{message}</p>
      {summary.overspentCategories.length > 0 && (
        <p className="mb-0 mt-1 text-sm text-alert">Spent more than planned: {summary.overspentCategories.join(', ')}.</p>
      )}
    </div>
  )
}

export function RoadmapWarnings({ warnings }: { warnings: RoadmapWarning[] }) {
  if (!warnings.length) return null
  return (
    <div role="status" className="rounded-lg border border-alert/30 bg-alert-soft p-4 text-sm">
      <p className="m-0 font-semibold text-alert">{warnings.length} milestone{warnings.length === 1 ? ' needs' : 's need'} attention</p>
      <ul className="mb-0 mt-1 list-disc pl-5 text-ink-soft">{warnings.map(w => <li key={w.rowId + w.kind}>{w.message}</li>)}</ul>
    </div>
  )
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2 hover:decoration-ink">{children}</button>
}
