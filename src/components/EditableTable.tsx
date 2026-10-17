import type { CellValue, Row, TableDef } from '../config/types'
import { FieldInput } from './FieldInput'

interface Props {
  def: TableDef
  rows: Row[]
  idPrefix: string
  highlightRowIds?: Set<string>
  onCell: (rowId: string, key: string, value: CellValue) => void
  onAdd: () => void
  onDelete: (rowId: string) => void
  onMove: (rowId: string, direction: -1 | 1) => void
}

const widthFor = (type: string) =>
  type === 'textarea' ? 'min-w-56' : type === 'date' ? 'min-w-36' : type === 'select' ? 'min-w-36' : ['number', 'money', 'percent'].includes(type) ? 'min-w-24' : 'min-w-40'

export function EditableTable({ def, rows, idPrefix, highlightRowIds, onCell, onAdd, onDelete, onMove }: Props) {
  const titleKey = def.task?.titleKey ?? def.columns[0].key
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line bg-sheet">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left">
              {def.columns.map(c => (
                <th key={c.key} scope="col" className={`border-b border-line px-2 py-2 font-semibold text-ink ${widthFor(c.type)}`}>{c.label}</th>
              ))}
              <th scope="col" className="border-b border-line px-2 py-2"><span className="sr-only">Row actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={def.columns.length + 1} className="px-3 py-6 text-ink-muted">No rows yet. Add the first one below.</td></tr>
            )}
            {rows.map((r, i) => {
              const rowName = String(r[titleKey] || `row ${i + 1}`)
              return (
                <tr key={r.id} className={`align-top ${highlightRowIds?.has(r.id) ? 'bg-alert-soft' : ''}`}>
                  {def.columns.map(c => (
                    <td key={c.key} className="border-b border-line px-1.5 py-1.5">
                      <FieldInput
                        id={`${idPrefix}-${r.id}-${c.key}`}
                        def={c}
                        value={r[c.key]}
                        compact
                        ariaLabel={`${c.label}, ${rowName}`}
                        onChange={v => onCell(r.id, c.key, v)}
                      />
                    </td>
                  ))}
                  <td className="border-b border-line px-1.5 py-1.5">
                    <div className="flex gap-1">
                      <IconButton label={`Move ${rowName} up`} disabled={i === 0} onClick={() => onMove(r.id, -1)}>↑</IconButton>
                      <IconButton label={`Move ${rowName} down`} disabled={i === rows.length - 1} onClick={() => onMove(r.id, 1)}>↓</IconButton>
                      <IconButton label={`Delete ${rowName}`} danger onClick={() => { if (confirm(`Delete "${rowName}"?`)) onDelete(r.id) }}>×</IconButton>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={onAdd} className="mt-2 rounded-md border border-line bg-sheet px-3 py-1.5 text-sm font-semibold text-ink hover:border-ink-muted">
        Add row
      </button>
    </div>
  )
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: string }) {
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md border border-line bg-sheet text-base leading-none disabled:opacity-30 ${danger ? 'text-alert hover:border-alert' : 'text-ink-muted hover:border-ink-muted'}`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
