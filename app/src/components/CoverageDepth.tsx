import { useState } from 'react'
import type { Agent, Tactic, CoverageLevel } from '../types'

// ATT&CK v16 Enterprise — authoritative technique count per tactic
const TACTIC_TOTAL: Record<string, number> = {
  TA0043: 10, TA0042: 8,  TA0001: 10, TA0002: 14,
  TA0003: 19, TA0004: 14, TA0005: 43, TA0006: 17,
  TA0007: 32, TA0008: 9,  TA0009: 17, TA0010: 9,
  TA0011: 18, TA0040: 14,
}

// Parent technique ID (T1234.001 → T1234)
function parentId(id: string): string {
  return id.includes('.') ? id.split('.')[0] : id
}

interface TacticStats {
  tactic: Tactic
  agentCount: number        // agents with any coverage (covered/partial)
  agentsCovered: string[]   // agent ids
  uniqueTIds: string[]      // unique parent T-IDs covered by ANY agent
  total: number             // ATT&CK v16 total
  depthPct: number          // uniqueTIds.length / total * 100
}

interface AgentTacticStatus {
  coverage: CoverageLevel | 'none'
  tIds: string[]
}

function buildStats(agents: Agent[], tactics: Tactic[]): TacticStats[] {
  return tactics.map((tactic) => {
    const agentsCovered: string[] = []
    const allTIds = new Set<string>()

    agents.forEach((agent) => {
      let bestLevel: CoverageLevel | null = null
      agent.techniques.forEach((t) => {
        // resolve to parent T-ID, then check if ATT&CK tactic matches
        // We approximate by checking if a technique in this tactic matches
        const inTactic = tactic.techniques.some(
          (tt) => tt.id === parentId(t.id) ||
                  tt.sub_techniques.some((st) => st.id === t.id)
        )
        if (!inTactic) return
        if (t.coverage !== 'not-covered') {
          allTIds.add(parentId(t.id))
          if (!bestLevel || t.coverage === 'covered') bestLevel = t.coverage
        }
      })
      if (bestLevel) agentsCovered.push(agent.id)
    })

    const uniqueTIds = [...allTIds].sort()
    const total = TACTIC_TOTAL[tactic.id] ?? tactic.techniques.length
    return {
      tactic,
      agentCount: agentsCovered.length,
      agentsCovered,
      uniqueTIds,
      total,
      depthPct: total > 0 ? (uniqueTIds.length / total) * 100 : 0,
    }
  })
}

function getAgentTacticStatus(agent: Agent, tactic: Tactic): AgentTacticStatus {
  let best: CoverageLevel | 'none' = 'none'
  const tIds: string[] = []
  agent.techniques.forEach((t) => {
    const inTactic = tactic.techniques.some(
      (tt) => tt.id === parentId(t.id) ||
               tt.sub_techniques.some((st) => st.id === t.id)
    )
    if (!inTactic) return
    if (t.coverage !== 'not-covered') {
      tIds.push(parentId(t.id))
      if (best === 'none' || t.coverage === 'covered') best = t.coverage
      else if (best === 'not-covered' && t.coverage === 'partial') best = 'partial'
    }
  })
  return { coverage: best, tIds: [...new Set(tIds)].sort() }
}

function statusSymbol(c: CoverageLevel | 'none'): string {
  if (c === 'covered') return '✅'
  if (c === 'partial') return '⚠️'
  if (c === 'tool-dep') return '🔧'
  return '—'
}

function statusClass(c: CoverageLevel | 'none'): string {
  if (c === 'covered') return 'depth-cell--covered'
  if (c === 'partial') return 'depth-cell--partial'
  if (c === 'tool-dep') return 'depth-cell--tooldep'
  return 'depth-cell--none'
}

interface Props {
  agents: Agent[]
  tactics: Tactic[]
  onSelectAgent: (id: string) => void
}

export function CoverageDepth({ agents, tactics, onSelectAgent }: Props) {
  const stats = buildStats(agents, tactics)
  const [hoveredCell, setHoveredCell] = useState<{ agentId: string; tacticId: string } | null>(null)

  const totalUnique = new Set(
    agents.flatMap((a) => a.techniques.filter((t) => t.coverage !== 'not-covered').map((t) => parentId(t.id)))
  ).size
  const totalATT = Object.values(TACTIC_TOTAL).reduce((s, v) => s + v, 0)
  const uncoveredTactics = stats.filter((s) => s.agentCount === 0)

  return (
    <div className="depth-panel">

      {/* ── Summary bar ── */}
      <div className="depth-summary">
        <div className="depth-stat">
          <span className="depth-stat-value">{agents.length}</span>
          <span className="depth-stat-label">Agents</span>
        </div>
        <div className="depth-stat">
          <span className="depth-stat-value">{totalUnique}<span className="depth-stat-denom">/{totalATT}</span></span>
          <span className="depth-stat-label">Unique Techniques Covered</span>
        </div>
        <div className="depth-stat depth-stat--warn">
          <span className="depth-stat-value">{((totalUnique / totalATT) * 100).toFixed(1)}%</span>
          <span className="depth-stat-label">Overall Depth</span>
        </div>
        <div className="depth-stat depth-stat--danger">
          <span className="depth-stat-value">{uncoveredTactics.length}</span>
          <span className="depth-stat-label">Tactics Uncovered</span>
        </div>
        <div className="depth-stat">
          <span className="depth-stat-value">{stats.filter((s) => s.depthPct > 0 && s.depthPct < 20).length}</span>
          <span className="depth-stat-label">Tactics &lt;20% Depth</span>
        </div>
      </div>

      {/* ── Table B: Technique Depth ── */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Table B — Technique Depth per Tactic
          <span className="depth-section-sub">coverage across all 19 agents combined</span>
        </h2>
        <div className="depth-table-b-wrap">
          <table className="depth-table-b">
            <thead>
              <tr>
                <th>Tactic</th>
                <th>Agents</th>
                <th>Depth</th>
                <th>Bar</th>
                <th>Gap</th>
                <th>Covered T-IDs</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const pct = s.depthPct
                const gapColor = pct === 0 ? 'gap-zero' : pct < 20 ? 'gap-critical' : pct < 50 ? 'gap-significant' : 'gap-ok'
                return (
                  <tr key={s.tactic.id} className={`depth-row ${pct === 0 ? 'depth-row--zero' : ''}`}>
                    <td className="depth-tactic-cell">
                      <span className="depth-tactic-id">{s.tactic.id}</span>
                      <span className="depth-tactic-name">{s.tactic.name}</span>
                    </td>
                    <td className="depth-agents-cell">
                      {s.agentCount > 0 ? (
                        <span className="depth-agent-count">{s.agentCount}</span>
                      ) : (
                        <span className="depth-agent-zero">0</span>
                      )}
                    </td>
                    <td className="depth-pct-cell">
                      <span className={`depth-pct ${gapColor}`}>
                        {s.uniqueTIds.length}/{s.total}
                        <span className="depth-pct-pct"> {pct.toFixed(0)}%</span>
                      </span>
                    </td>
                    <td className="depth-bar-cell">
                      <div className="depth-bar-bg">
                        <div
                          className={`depth-bar-fill ${gapColor}`}
                          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </td>
                    <td className="depth-gap-cell">
                      <span className={`depth-gap-num ${gapColor}`}>−{s.total - s.uniqueTIds.length}</span>
                    </td>
                    <td className="depth-tids-cell">
                      {s.uniqueTIds.length === 0 ? (
                        <span className="depth-tids-empty">none</span>
                      ) : (
                        <span className="depth-tids">
                          {s.uniqueTIds.map((tid) => (
                            <code key={tid} className="tid depth-tid">{tid}</code>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Table A: Agent × Tactic matrix ── */}
      <section className="depth-section">
        <h2 className="depth-section-title">
          Table A — Agent × Tactic Matrix
          <span className="depth-section-sub">✅ covered &nbsp; ⚠️ partial &nbsp; — not covered &nbsp;|&nbsp; hover for technique IDs</span>
        </h2>
        <div className="depth-matrix-wrap">
          <table className="depth-matrix">
            <thead>
              <tr>
                <th className="depth-matrix-agent-th">Agent</th>
                {tactics.map((t) => (
                  <th key={t.id} className="depth-matrix-tactic-th" title={t.name}>
                    <span className="depth-matrix-tactic-id">{t.id}</span>
                    <span className="depth-matrix-tactic-name">{t.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="depth-matrix-agent-td">
                    <button
                      className="depth-agent-btn"
                      onClick={() => onSelectAgent(agent.id)}
                    >
                      {agent.name}
                    </button>
                  </td>
                  {tactics.map((tactic) => {
                    const status = getAgentTacticStatus(agent, tactic)
                    const isHovered = hoveredCell?.agentId === agent.id && hoveredCell?.tacticId === tactic.id
                    return (
                      <td
                        key={tactic.id}
                        className={`depth-cell ${statusClass(status.coverage)}`}
                        onMouseEnter={() => setHoveredCell({ agentId: agent.id, tacticId: tactic.id })}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={status.tIds.length > 0 ? status.tIds.join(', ') : 'Not covered'}
                      >
                        <span className="depth-cell-symbol">{statusSymbol(status.coverage)}</span>
                        {isHovered && status.tIds.length > 0 && (
                          <div className="depth-cell-tooltip">
                            <div className="depth-cell-tooltip-header">
                              {agent.name} × {tactic.name}
                            </div>
                            {status.tIds.map((tid) => (
                              <code key={tid} className="tid depth-cell-tid">{tid}</code>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
