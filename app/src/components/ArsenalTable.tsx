import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ArsenalItem, Tactic, ItemKind } from '../types'
import { toRow, type ArsenalRow } from '../utils/arsenal'

const KINDS: (ItemKind | 'all')[] = ['all', 'ai-agent', 'agent-framework', 'tool', 'lab-dataset']

export function ArsenalTable({ items, tactics }: { items: ArsenalItem[]; tactics: Tactic[] }) {
  const [kind, setKind] = useState<ItemKind | 'all'>('all')
  const [sortKey, setSortKey] = useState<keyof ArsenalRow>('stars')
  const rows = useMemo(() => {
    let r = items.map((it) => toRow(it, tactics))
    if (kind !== 'all') r = r.filter((x) => x.kind === kind)
    return r.sort((a, b) => (b[sortKey] > a[sortKey] ? 1 : b[sortKey] < a[sortKey] ? -1 : 0))
  }, [items, tactics, kind, sortKey])
  const cols: (keyof ArsenalRow)[] = ['name','kind','category','stars','tacticSpan','covered','partial','toolDep','autonomy','language']
  return (
    <div className="arsenal-table-wrap">
      <div className="arsenal-filters">
        {KINDS.map((k) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k}</button>
        ))}
      </div>
      <table className="arsenal-table">
        <thead><tr>
          {cols.map((k) => (
            <th key={k} onClick={() => setSortKey(k)} className={sortKey === k ? 'sorted' : ''}>{k}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link to={`/arsenal/${row.id}`}>{row.name}</Link></td>
              <td>{row.kind}</td><td>{row.category}</td><td>{row.stars}</td>
              <td>{row.tacticSpan}</td><td>{row.covered}</td><td>{row.partial}</td><td>{row.toolDep}</td>
              <td>{row.autonomy}</td><td>{row.language}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
