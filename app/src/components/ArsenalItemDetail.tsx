import type { ArsenalItem, Tactic } from '../types'
import { getCoveredTechniquesInTactic } from '../utils/attack'

export function ArsenalItemDetail({ item, tactics }: { item: ArsenalItem; tactics: Tactic[] }) {
  return (
    <div className="arsenal-detail">
      <h2>{item.name} <a href={item.url} target="_blank" rel="noreferrer">↗</a></h2>
      <p className="arsenal-meta">{item.kind} · {item.category} · ★{item.stars} · {item.autonomy ?? 'tool'}</p>
      <p>{item.description}</p>
      {tactics.map((t) => {
        const techs = getCoveredTechniquesInTactic(item, t)
        if (techs.length === 0) return null
        return (
          <section key={t.id}>
            <h3>{t.name}</h3>
            <ul>{techs.map((x) => <li key={x.id}><code>{x.id}</code> {x.name} — <b>{x.coverage}</b> · {x.notes}</li>)}</ul>
          </section>
        )
      })}
    </div>
  )
}
