import { useState } from 'react'
import { useData } from './hooks/useData'
import { AgentTabs } from './components/AgentTabs'
import { TacticSection } from './components/TacticSection'
import { TacticToc } from './components/TacticToc'
import { PaperSidebar } from './components/PaperSidebar'
import { OverviewMatrix } from './components/OverviewMatrix'
import type { Agent } from './types'

export default function App() {
  const { papers, attack, loading, error } = useData()
  const [selectedAgentId, setSelectedAgentId] = useState<string | 'overview'>('overview')

  if (loading) return <div className="app-loading">Loading ATT&amp;CK data...</div>
  if (error || !papers) return <div className="app-error">Error: {error ?? 'No data'}</div>

  const selectedAgent: Agent | undefined =
    selectedAgentId !== 'overview'
      ? papers.agents.find((a) => a.id === selectedAgentId)
      : undefined

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-logo">
          RedTeam AI <span className="topbar-logo-sub">× MITRE ATT&amp;CK Enterprise</span>
        </span>
      </header>

      <AgentTabs
        agents={papers.agents}
        selectedId={selectedAgentId}
        onSelect={setSelectedAgentId}
      />

      <div className="main-body">
        {selectedAgentId === 'overview' ? (
          <OverviewMatrix
            agents={papers.agents}
            tactics={attack.tactics}
            onSelectAgent={setSelectedAgentId}
          />
        ) : selectedAgent ? (
          <>
            <TacticToc tactics={attack.tactics} agent={selectedAgent} />
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
                <TacticSection key={tactic.id} tactic={tactic} agent={selectedAgent} />
              ))}
            </div>
            <PaperSidebar agent={selectedAgent} attack={attack} />
          </>
        ) : null}
      </div>
    </div>
  )
}
