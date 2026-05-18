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
                <span className="cls-item"><span className="coverage-dot coverage-dot--covered" />Fully automated</span>
                <span className="cls-item"><span className="coverage-dot coverage-dot--partial" />Partially automated</span>
                <span className="cls-item"><span className="coverage-dot coverage-dot--tool-dep" />Requires external tool</span>
                <span className="cls-hint">Hover a technique to see evidence</span>
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
