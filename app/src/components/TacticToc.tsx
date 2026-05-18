import { countCoveredInTactic, countPartialInTactic, countToolDepInTactic } from '../utils/attack'
import type { Agent, Tactic } from '../types'

interface Props {
  tactics: Tactic[]
  agent: Agent
}

export function TacticToc({ tactics, agent }: Props) {
  function scrollTo(tacticId: string) {
    document.getElementById(`tactic-${tacticId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="tactic-toc" aria-label="Jump to tactic">
      <div className="toc-header">Tactics</div>
      {tactics.map((tactic) => {
        const total =
          countCoveredInTactic(agent, tactic) +
          countPartialInTactic(agent, tactic) +
          countToolDepInTactic(agent, tactic)
        return (
          <button
            key={tactic.id}
            className={`toc-item${total > 0 ? ' toc-item--active' : ''}`}
            onClick={() => scrollTo(tactic.id)}
            title={tactic.name}
          >
            <span className="toc-tid">{tactic.id}</span>
            <span className="toc-name">{tactic.name}</span>
            {total > 0 && <span className="toc-badge">{total}</span>}
          </button>
        )
      })}
    </nav>
  )
}
