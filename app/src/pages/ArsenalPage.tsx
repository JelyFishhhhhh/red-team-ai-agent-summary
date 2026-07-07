import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useArsenal } from '../hooks/useArsenal'
import type { Tactic } from '../types'
import { ArsenalTable } from '../components/ArsenalTable'
import { ArsenalMatrix } from '../components/ArsenalMatrix'
import { ArsenalItemDetail } from '../components/ArsenalItemDetail'

export function ArsenalPage({ tactics }: { tactics: Tactic[] }) {
  const { arsenal, loading, error } = useArsenal()
  const { id } = useParams()
  const [view, setView] = useState<'table' | 'matrix'>('table')

  if (loading) return <div className="app-loading">Loading arsenal…</div>
  if (error || !arsenal) return <div className="app-error">Error: {error ?? 'no data'}</div>

  if (id) {
    const item = arsenal.items.find((i) => i.id === id)
    return (
      <div className="arsenal-page">
        <Link to="/arsenal" className="arsenal-back">← Arsenal</Link>
        {item
          ? <ArsenalItemDetail item={item} tactics={tactics} />
          : <div className="app-error">No item “{id}”.</div>}
      </div>
    )
  }

  return (
    <div className="arsenal-page">
      <div className="arsenal-viewswitch">
        <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Inventory</button>
        <button className={view === 'matrix' ? 'active' : ''} onClick={() => setView('matrix')}>Coverage Matrix</button>
        <span className="arsenal-count">{arsenal.items.length} items</span>
      </div>
      {view === 'table'
        ? <ArsenalTable items={arsenal.items} tactics={tactics} />
        : <ArsenalMatrix items={arsenal.items} tactics={tactics} />}
    </div>
  )
}
