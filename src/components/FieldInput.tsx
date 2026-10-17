import type { CellValue, ColumnDef, FieldDef } from '../config/types'

const NUMERIC = new Set(['number', 'money', 'percent'])

interface Props {
  id: string
  def: FieldDef | ColumnDef
  value: CellValue | undefined
  onChange: (value: CellValue) => void
  compact?: boolean
  ariaLabel?: string
  describedBy?: string
}

/** One control for every field type in the config. Numbers are stored as numbers, empty as ''. */
export function FieldInput({ id, def, value, onChange, compact, ariaLabel, describedBy }: Props) {
  const v = value ?? ''
  const common = { id, 'aria-label': ariaLabel, 'aria-describedby': describedBy, className: `field-control ${compact ? 'text-sm' : ''}` }

  if (def.type === 'select') {
    const options = def.options ?? []
    const current = String(v)
    return (
      <select {...common} value={current} onChange={e => onChange(e.target.value)}>
        {!options.includes(current) && <option value={current}>{current || 'Choose…'}</option>}
        {options.map(o => <option key={o} value={o}>{o || 'Choose…'}</option>)}
      </select>
    )
  }
  if (def.type === 'textarea') {
    return <textarea {...common} rows={compact ? 2 : 4} value={String(v)} onChange={e => onChange(e.target.value)} className={`${common.className} resize-y`} />
  }
  if (NUMERIC.has(def.type)) {
    return (
      <input
        {...common}
        type="number"
        inputMode="decimal"
        step="any"
        min={def.type === 'percent' ? 0 : undefined}
        max={def.type === 'percent' ? 100 : undefined}
        value={v === '' ? '' : String(v)}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={`${common.className} tabular-nums`}
      />
    )
  }
  return <input {...common} type={def.type === 'date' ? 'date' : 'text'} value={String(v)} onChange={e => onChange(e.target.value)} />
}
