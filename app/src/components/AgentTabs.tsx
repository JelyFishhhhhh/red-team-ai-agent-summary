import type { Agent } from '../types'

interface Props {
  agents: Agent[]
  selectedId: string
  onSelect: (id: string) => void
}

export function AgentTabs({ agents, selectedId, onSelect }: Props) {
  return (
    <nav className="agent-tabs" role="tablist" aria-label="Agent selection">
      <button
        role="tab"
        aria-selected={selectedId === 'overview'}
        className={`agent-tab overview${selectedId === 'overview' ? ' active' : ''}`}
        onClick={() => onSelect('overview')}
      >
        Overview
      </button>
      {agents.map((agent) => (
        <button
          key={agent.id}
          role="tab"
          aria-selected={selectedId === agent.id}
          className={`agent-tab${selectedId === agent.id ? ' active' : ''}`}
          onClick={() => onSelect(agent.id)}
        >
          {agent.name}
        </button>
      ))}
    </nav>
  )
}
