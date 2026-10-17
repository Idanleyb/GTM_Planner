import { useState } from 'react'
import type { CellValue, Project, SectionDef } from '../config/types'
import { buildAiRequest } from '../ai/describe'
import type { AiAction, AiResult, FieldProposal, RowProposal } from '../../supabase/functions/_shared/aiLogic'
import type { AiService } from '../services/types'
import { AiError } from '../services/types'

interface Props {
  ai: AiService
  section: SectionDef
  project: Project
  today: Date
  /** Viewers can only ask for a critique. */
  canEdit: boolean
  onApplyField: (key: string, value: CellValue) => void
  onApplyRow: (table: string, values: Record<string, CellValue>) => void
}

type State =
  | { s: 'idle' }
  | { s: 'loading'; action: AiAction }
  | { s: 'error'; message: string }
  | { s: 'done'; action: AiAction; result: AiResult }

const ACTIONS: { id: AiAction; label: string; busy: string; edit: boolean }[] = [
  { id: 'draft', label: 'Draft this step', busy: 'Drafting', edit: true },
  { id: 'fill', label: 'Fill the gaps', busy: 'Filling gaps', edit: true },
  { id: 'critique', label: 'Critique', busy: 'Reviewing', edit: false },
]

/** Ask Claude to draft, gap-fill or critique the current step. Nothing changes until the user applies a suggestion. */
export function AiAssist({ ai, section, project, today, canEdit, onApplyField, onApplyRow }: Props) {
  const [state, setState] = useState<State>({ s: 'idle' })
  const [left, setLeft] = useState<{ remaining: number; limit: number } | null>(null)
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState(0)

  const run = async (action: AiAction) => {
    setState({ s: 'loading', action }); setHandled(new Set()); setApplied(0)
    try {
      const r = await ai.run(buildAiRequest(action, section, project, today))
      setLeft({ remaining: r.remaining, limit: r.limit })
      setState({ s: 'done', action, result: r.result })
    } catch (e) {
      if (e instanceof AiError && e.remaining !== undefined) setLeft(l => ({ remaining: e.remaining!, limit: l?.limit ?? 0 }))
      setState({ s: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const fieldId = (p: FieldProposal) => `f:${p.key}`
  const rowId = (p: RowProposal, i: number) => `r:${p.table}:${i}`
  const applyField = (p: FieldProposal) => { onApplyField(p.key, p.value); setHandled(h => new Set(h).add(fieldId(p))); setApplied(n => n + 1) }
  const applyRow = (p: RowProposal, i: number) => { onApplyRow(p.table, p.values); setHandled(h => new Set(h).add(rowId(p, i))); setApplied(n => n + 1) }
  const skip = (id: string) => setHandled(h => new Set(h).add(id))

  const loading = state.s === 'loading'
  return (
    <section aria-label="AI assist" className="mt-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.filter(a => canEdit || !a.edit).map(a => (
          <button key={a.id} type="button" disabled={loading} onClick={() => void run(a.id)}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${a.id === 'draft' ? 'border-ink bg-ink text-white hover:bg-ink-soft' : 'border-line bg-sheet text-ink hover:border-ink-muted'}`}>
            {loading && state.action === a.id ? `${a.busy}…` : a.label}
          </button>
        ))}
        <span className="text-sm text-ink-muted">
          {left ? `AI by Claude. ${left.remaining} of ${left.limit} requests left today.` : 'AI by Claude. You review every suggestion before it changes the plan.'}
        </span>
      </div>

      <div aria-live="polite">
        {loading && <p className="mb-0 mt-3 text-sm text-ink-soft">Reading your plan and this step. This takes a few seconds.</p>}
        {state.s === 'error' && <p role="alert" className="mb-0 mt-3 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{state.message}</p>}
        {state.s === 'done' && (
          <div className="mt-3 rounded-lg border border-line border-l-4 border-l-signal bg-sheet p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="m-0 text-ink">{state.result.summary || (state.result.kind === 'critique' ? 'Review complete.' : 'Suggestions ready.')}</p>
              <button type="button" onClick={() => setState({ s: 'idle' })} className="shrink-0 text-sm text-ink-muted underline underline-offset-2 hover:text-ink">Close</button>
            </div>
            {state.result.kind === 'critique'
              ? <Findings result={state.result} />
              : <Proposals result={state.result} section={section} handled={handled} applied={applied} canEdit={canEdit}
                  fieldId={fieldId} rowId={rowId} applyField={applyField} applyRow={applyRow} skip={skip} />}
          </div>
        )}
      </div>
    </section>
  )
}

function Findings({ result }: { result: Extract<AiResult, { kind: 'critique' }> }) {
  if (!result.findings.length) return <p className="mb-0 mt-3 text-sm text-ready">No issues found in this step.</p>
  const tone = { high: 'bg-alert-soft text-alert', medium: 'bg-signal-soft text-ink', low: 'bg-paper text-ink-soft' }
  const label = { high: 'High risk', medium: 'Medium', low: 'Low' }
  return (
    <ul className="m-0 mt-3 list-none space-y-3 p-0">
      {result.findings.map((f, i) => (
        <li key={i} className="grid gap-x-3 gap-y-1 sm:grid-cols-[6.5rem_1fr]">
          <span className={`h-fit w-fit rounded px-2 py-0.5 text-xs font-semibold ${tone[f.severity]}`}>{label[f.severity]}</span>
          <div>
            <p className="m-0 font-semibold text-ink">{f.issue}</p>
            {f.suggestion && <p className="m-0 text-sm text-ink-soft">{f.suggestion}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

interface ProposalsProps {
  result: Extract<AiResult, { kind: 'proposal' }>
  section: SectionDef
  handled: Set<string>
  applied: number
  canEdit: boolean
  fieldId: (p: FieldProposal) => string
  rowId: (p: RowProposal, i: number) => string
  applyField: (p: FieldProposal) => void
  applyRow: (p: RowProposal, i: number) => void
  skip: (id: string) => void
}

function Proposals({ result, section, handled, applied, canEdit, fieldId, rowId, applyField, applyRow, skip }: ProposalsProps) {
  const fields = result.fields.filter(p => !handled.has(fieldId(p)))
  const rows = result.rows.map((p, i) => ({ p, i })).filter(({ p, i }) => !handled.has(rowId(p, i)))
  const total = result.fields.length + result.rows.length
  const colLabel = (table: string, key: string) => section.tables?.find(t => t.key === table)?.columns.find(c => c.key === key)?.label ?? key
  const fmt = (v: CellValue) => String(v)

  if (!total) {
    return <p className="mb-0 mt-3 text-sm text-ink-soft">Nothing to add: this step already covers what Claude would suggest.{result.dropped ? ` ${result.dropped} suggestion${result.dropped === 1 ? '' : 's'} didn’t fit this step’s fields and ${result.dropped === 1 ? 'was' : 'were'} left out.` : ''}</p>
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 text-sm">
        <span className="text-ink-soft">
          {fields.length + rows.length} of {total} suggestion{total === 1 ? '' : 's'} left to review{applied ? `, ${applied} applied` : ''}.
        </span>
        {canEdit && fields.length + rows.length > 1 && (
          <button type="button" onClick={() => { fields.forEach(applyField); rows.forEach(({ p, i }) => applyRow(p, i)) }}
            className="rounded-md bg-ink px-3 py-1.5 font-semibold text-white hover:bg-ink-soft">Apply all</button>
        )}
      </div>
      <ul className="m-0 list-none divide-y divide-line p-0">
        {fields.map(p => (
          <li key={fieldId(p)} className="py-3">
            <p className="m-0 text-sm font-semibold text-ink">{p.label}</p>
            <p className="m-0 mt-1 whitespace-pre-line text-ink">{fmt(p.value)}</p>
            {String(p.previous ?? '').trim() && <p className="m-0 mt-1 text-sm text-ink-muted">Replaces: <span className="line-through">{fmt(p.previous).slice(0, 200)}</span></p>}
            {p.reason && <p className="m-0 mt-1 text-sm text-ink-muted">Why: {p.reason}</p>}
            <Choice canEdit={canEdit} label={p.label} onApply={() => applyField(p)} onSkip={() => skip(fieldId(p))} />
          </li>
        ))}
        {rows.map(({ p, i }) => (
          <li key={rowId(p, i)} className="py-3">
            <p className="m-0 text-sm font-semibold text-ink">New row in {p.tableTitle}</p>
            <dl className="m-0 mt-1 grid gap-x-3 text-sm sm:grid-cols-[minmax(7rem,max-content)_1fr]">
              {Object.entries(p.values).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-ink-muted">{colLabel(p.table, k)}</dt><dd className="m-0 text-ink">{fmt(v)}</dd></div>
              ))}
            </dl>
            {p.reason && <p className="m-0 mt-1 text-sm text-ink-muted">Why: {p.reason}</p>}
            <Choice canEdit={canEdit} label={`row ${String(Object.values(p.values)[0] ?? i + 1)}`} onApply={() => applyRow(p, i)} onSkip={() => skip(rowId(p, i))} />
          </li>
        ))}
      </ul>
      {result.dropped > 0 && <p className="mb-0 mt-1 text-sm text-ink-muted">{result.dropped} suggestion{result.dropped === 1 ? '' : 's'} didn’t fit this step’s fields and {result.dropped === 1 ? 'was' : 'were'} left out.</p>}
    </div>
  )
}

function Choice({ canEdit, label, onApply, onSkip }: { canEdit: boolean; label: string; onApply: () => void; onSkip: () => void }) {
  if (!canEdit) return null
  return (
    <div className="mt-2 flex gap-2">
      <button type="button" onClick={onApply} aria-label={`Apply ${label}`} className="rounded-md border border-ink px-3 py-1 text-sm font-semibold text-ink hover:bg-ink hover:text-white">Apply</button>
      <button type="button" onClick={onSkip} aria-label={`Skip ${label}`} className="rounded-md px-3 py-1 text-sm text-ink-muted underline underline-offset-2 hover:text-ink">Skip</button>
    </div>
  )
}
