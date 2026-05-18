import type { Agent } from '../types'
interface Props { agents: Agent[]; selectedId: string; onSelect: (id: string) => void }
export function AgentTabs({ agents, selectedId, onSelect }: Props) {
  return (
    <nav className="agent-tabs">
      <button className={`agent-tab overview${selectedId === 'overview' ? ' active' : ''}`} onClick={() => onSelect('overview')}>Overview</button>
      {agents.map(a => (
        <button key={a.id} className={`agent-tab${selectedId === a.id ? ' active' : ''}`} onClick={() => onSelect(a.id)}>{a.name}</button>
      ))}
    </nav>
  )
}
