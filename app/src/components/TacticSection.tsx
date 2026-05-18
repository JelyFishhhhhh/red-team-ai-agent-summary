import { useState } from 'react'
import { countCoveredInTactic, countPartialInTactic, countToolDepInTactic } from '../utils/attack'
import { TechniqueRow } from './TechniqueRow'
import type { Tactic, Agent } from '../types'

interface Props {
  tactic: Tactic
  agent: Agent
}

export function TacticSection({ tactic, agent }: Props) {
  const [open, setOpen] = useState(true)
  const coveredCount = countCoveredInTactic(agent, tactic)
  const partialCount = countPartialInTactic(agent, tactic)
  const toolDepCount = countToolDepInTactic(agent, tactic)
  const totalActive = coveredCount + partialCount + toolDepCount

  return (
    <div className="tactic-section">
      <button
        className="tactic-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="tactic-id">{tactic.id}</span>
        <span className="tactic-name">{tactic.name}</span>
        <span className={`tactic-badge${totalActive === 0 ? ' zero' : ''}`}>
          {coveredCount > 0 && <span className="badge-covered">{coveredCount}</span>}
          {partialCount > 0 && <span className="badge-partial">{partialCount}~</span>}
          {toolDepCount > 0 && <span className="badge-tooldep">{toolDepCount}⚙</span>}
          {totalActive === 0 && '0 covered'}
        </span>
        <span className="tactic-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="technique-list">
          {tactic.techniques.map((tech) => (
            <TechniqueRow key={tech.id} technique={tech} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
