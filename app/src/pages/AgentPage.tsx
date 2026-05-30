import { useParams, Navigate } from 'react-router-dom'
import { TacticSection } from '../components/TacticSection'
import { TacticToc } from '../components/TacticToc'
import { PaperSidebar } from '../components/PaperSidebar'
import type { Agent, AttackData, PapersData } from '../types'

interface Props {
  papers: PapersData
  attack: AttackData
}

export function AgentPage({ papers, attack }: Props) {
  const { agentId } = useParams<{ agentId: string }>()
  const agent: Agent | undefined = papers.agents.find((a) => a.id === agentId)

  if (!agent) return <Navigate to="/" replace />

  return (
    <>
      <TacticToc tactics={attack.tactics} agent={agent} />
      <div className="technique-panel">
        <div className="coverage-legend-strip">
          <span className="cls-layers">
            <span className="cls-layer">L1 Tactic</span>
            <span className="cls-arrow">→</span>
            <span className="cls-layer">L2 Technique</span>
            <span className="cls-arrow">→</span>
            <span className="cls-layer">L3 Coverage</span>
          </span>
          <span className="cls-sep">|</span>
          <span className="cls-item"><span className="coverage-badge coverage-badge--covered">C</span>Covered</span>
          <span className="cls-item"><span className="coverage-badge coverage-badge--partial">P</span>Partial</span>
          <span className="cls-item"><span className="coverage-badge coverage-badge--tool-dep">T</span>Tool-dep</span>
          <span className="cls-item"><span className="coverage-badge coverage-badge--not-covered">N</span>Not covered</span>
          <span className="cls-sep">|</span>
          <span className="cls-item"><span className="tier-badge">T1</span>Paper</span>
          <span className="cls-item"><span className="tier-badge">T2</span>Docs</span>
          <span className="cls-item"><span className="tier-badge">T3</span>Case study</span>
          <span className="cls-item"><span className="tier-badge">T4</span>Inferred</span>
          <span className="cls-hint">Hover a row to see evidence</span>
        </div>
        {attack.tactics.map((tactic) => (
          <TacticSection key={tactic.id} tactic={tactic} agent={agent} />
        ))}
      </div>
      <PaperSidebar agent={agent} attack={attack} />
    </>
  )
}
