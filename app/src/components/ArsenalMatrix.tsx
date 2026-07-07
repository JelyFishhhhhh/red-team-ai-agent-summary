import type { ArsenalItem, Tactic } from '../types'
import { buildOverviewMatrix } from '../utils/attack'

export function ArsenalMatrix({ items, tactics }: { items: ArsenalItem[]; tactics: Tactic[] }) {
  const cells = buildOverviewMatrix(items, tactics)
  const cell = (itemId: string, tacticId: string) =>
    cells.find((c) => c.agentId === itemId && c.tacticId === tacticId)
  return (
    <div className="arsenal-matrix-wrap">
      <table className="overview-matrix">
        <thead><tr><th>Item</th>{tactics.map((t) => <th key={t.id} title={t.name}>{t.shortname}</th>)}</tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              {tactics.map((t) => {
                const c = cell(it.id, t.id)
                const n = (c?.coveredCount ?? 0) + (c?.partialCount ?? 0) + (c?.toolDepCount ?? 0)
                return <td key={t.id} className={n > 0 ? `cov-${Math.min(n, 4)}` : ''}>{n || ''}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
