import { buildOverviewMatrix } from '../utils/attack'
import type { Agent, Tactic } from '../types'

interface Props {
  agents: Agent[]
  tactics: Tactic[]
  onSelectAgent: (id: string) => void
}

export function OverviewMatrix({ agents, tactics, onSelectAgent }: Props) {
  const matrix = buildOverviewMatrix(agents, tactics)

  function getCell(agentId: string, tacticId: string) {
    return matrix.find((c) => c.agentId === agentId && c.tacticId === tacticId)
  }

  const maxTotal = Math.max(
    ...matrix.map((c) => c.coveredCount + c.partialCount + c.toolDepCount),
    1
  )

  function cellIntensity(agentId: string, tacticId: string): number {
    const cell = getCell(agentId, tacticId)
    if (!cell) return 0
    const total = cell.coveredCount + cell.partialCount + cell.toolDepCount
    return Math.round((total / maxTotal) * 5)
  }

  function cellLabel(agentId: string, tacticId: string): string {
    const cell = getCell(agentId, tacticId)
    if (!cell) return ''
    const total = cell.coveredCount + cell.partialCount + cell.toolDepCount
    return total > 0 ? String(total) : ''
  }

  function cellTitle(agent: Agent, tactic: Tactic): string {
    const cell = getCell(agent.id, tactic.id)
    if (!cell) return `${agent.name} × ${tactic.name}: 0`
    const parts: string[] = []
    if (cell.coveredCount) parts.push(`${cell.coveredCount} covered`)
    if (cell.partialCount) parts.push(`${cell.partialCount} partial`)
    if (cell.toolDepCount) parts.push(`${cell.toolDepCount} tool-dep`)
    return `${agent.name} × ${tactic.name}: ${parts.join(', ') || '0'}`
  }

  return (
    <div className="overview-panel">
      <h2 className="overview-title">Coverage Overview</h2>
      <p className="overview-subtitle">
        Each cell shows techniques covered per tactic. Click an agent to view details.
      </p>

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="matrix-th-agent">Agent</th>
              {tactics.map((t) => (
                <th key={t.id} className="matrix-th-tactic" title={t.name}>
                  <span className="tactic-th-id">{t.id}</span>
                  <span className="tactic-th-name">{t.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td className="matrix-td-agent">
                  <button className="agent-name-btn" onClick={() => onSelectAgent(agent.id)}>
                    {agent.name}
                  </button>
                </td>
                {tactics.map((tactic) => {
                  const intensity = cellIntensity(agent.id, tactic.id)
                  return (
                    <td
                      key={tactic.id}
                      className={`matrix-td-cell intensity-${intensity}`}
                      title={cellTitle(agent, tactic)}
                    >
                      {cellLabel(agent.id, tactic.id)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matrix-legend">
        <span>Coverage density:</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`legend-swatch intensity-${i}`}>
            {i === 0 ? '0' : i === 5 ? 'max' : ''}
          </span>
        ))}
        <span className="legend-sep">|</span>
        <span className="legend-key covered-key">■ covered</span>
        <span className="legend-key partial-key">■ partial</span>
        <span className="legend-key tooldep-key">■ tool-dep</span>
      </div>
    </div>
  )
}
