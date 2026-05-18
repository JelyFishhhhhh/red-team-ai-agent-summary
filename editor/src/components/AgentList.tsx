import type { Agent } from '../types'

interface Props {
  agents: Agent[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

export function AgentList({ agents, selectedId, onSelect, onAdd, onDelete }: Props) {
  return (
    <div className="agent-sidebar">
      <div className="sidebar-header">
        <span>Agents</span>
        <button className="btn-add" onClick={onAdd} title="Add agent">+ Add</button>
      </div>
      {agents.map((agent) => (
        <div
          key={agent.id}
          className={`agent-item${selectedId === agent.id ? ' selected' : ''}`}
          onClick={() => onSelect(agent.id)}
        >
          <span>{agent.name}</span>
          {selectedId === agent.id && (
            <button
              className="btn-danger"
              onClick={(e) => { e.stopPropagation(); onDelete(agent.id) }}
              title="Delete agent"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
