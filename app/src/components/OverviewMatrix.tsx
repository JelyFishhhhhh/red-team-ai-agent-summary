import { useState } from 'react'
import { buildOverviewMatrix, getCoveredTechniquesInTactic } from '../utils/attack'
import type { Agent, Tactic } from '../types'
import type { TechniqueInfo } from '../utils/attack'

interface Props {
  agents: Agent[]
  tactics: Tactic[]
  onSelectAgent: (id: string) => void
}

interface TooltipState {
  x: number
  y: number
  showAbove: boolean
  agentName: string
  tacticName: string
  techniques: TechniqueInfo[]
}


export function OverviewMatrix({ agents, tactics, onSelectAgent }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
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

  function handleCellEnter(e: React.MouseEvent<HTMLTableCellElement>, agent: Agent, tactic: Tactic) {
    const rect = e.currentTarget.getBoundingClientRect()
    const techniques = getCoveredTechniquesInTactic(agent, tactic)
    const x = Math.min(rect.left, window.innerWidth - 290)
    const showAbove = rect.bottom > window.innerHeight * 0.55
    setTooltip({
      x,
      y: showAbove ? rect.top - 4 : rect.bottom + 4,
      showAbove,
      agentName: agent.name,
      tacticName: tactic.name,
      techniques,
    })
  }

  return (
    <div className="overview-panel" onMouseLeave={() => setTooltip(null)}>
      <h2 className="overview-title">Coverage Overview</h2>
      <p className="overview-subtitle">
        Hover a cell to see covered techniques. Click an agent name to view details.
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
                      onMouseEnter={(e) => handleCellEnter(e, agent, tactic)}
                      onMouseLeave={() => setTooltip(null)}
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

      {tooltip && (
        <div
          className="matrix-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: tooltip.showAbove ? 'translateY(-100%)' : 'none',
          }}
        >
          <div className="matrix-tooltip-header">
            <strong>{tooltip.agentName}</strong>
            <span className="matrix-tooltip-x"> × </span>
            {tooltip.tacticName}
          </div>
          {tooltip.techniques.length === 0 ? (
            <div className="matrix-tooltip-empty">No techniques covered in this tactic</div>
          ) : (
            <div className="matrix-tooltip-list">
              {tooltip.techniques.map((t) => (
                <div key={t.id} className="matrix-tooltip-row">
                  <span className={`coverage-badge coverage-badge--${t.coverage}`}>{t.coverage === 'covered' ? 'C' : t.coverage === 'partial' ? 'P' : t.coverage === 'tool-dep' ? 'T' : 'N'}</span>
                  <span className="tid matrix-tooltip-tid">{t.id}</span>
                  <span className="matrix-tooltip-name">{t.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
