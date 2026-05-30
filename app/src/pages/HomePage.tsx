import { Link } from 'react-router-dom'
import type { Agent } from '../types'

interface Props {
  agents: Agent[]
}

function coverageCount(agent: Agent, level: string) {
  return agent.techniques.filter((t) => t.coverage === level).length
}

function hasPaperBadge(agent: Agent) {
  return agent.has_paper
    ? <span className="badge badge--paper">Paper</span>
    : <span className="badge badge--nopaper">No Paper</span>
}

export function HomePage({ agents }: Props) {
  const withPaper = agents.filter((a) => a.has_paper).length
  const withoutPaper = agents.length - withPaper
  const totalTechniques = agents.reduce((s, a) => s + a.techniques.filter((t) => t.coverage !== 'not-covered').length, 0)

  return (
    <div className="home-panel">
      <div className="home-hero">
        <h1 className="home-title">Red Team AI Agents</h1>
        <p className="home-subtitle">
          ATT&amp;CK Technique Coverage Analysis across {agents.length} autonomous agents
        </p>
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat-val">{agents.length}</span>
            <span className="home-stat-lbl">Agents</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-val">{withPaper}</span>
            <span className="home-stat-lbl">With Paper</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-val">{withoutPaper}</span>
            <span className="home-stat-lbl">No Paper</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-val">{totalTechniques}</span>
            <span className="home-stat-lbl">Total Technique Mappings</span>
          </div>
        </div>
      </div>

      <div className="home-table-wrap">
        <table className="home-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Type</th>
              <th>Venue / Year</th>
              <th>Benchmark</th>
              <th className="home-th-cov">Covered</th>
              <th className="home-th-cov">Partial</th>
              <th className="home-th-cov">Not Covered</th>
              <th>Key Limitation</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const covered = coverageCount(agent, 'covered')
              const partial = coverageCount(agent, 'partial')
              const notCovered = coverageCount(agent, 'not-covered')
              const total = covered + partial + notCovered
              const score = agent.benchmark?.score ?? '—'
              const benchNotes = agent.benchmark?.notes ?? ''
              const firstLimit = agent.limitations?.[0] ?? '—'
              const allLimits = agent.limitations?.join(' | ') ?? ''

              return (
                <tr key={agent.id} className="home-row">
                  <td className="home-td-name">
                    <Link to={`/${agent.id}`} className="home-agent-link">
                      {agent.name}
                    </Link>
                  </td>
                  <td className="home-td-badge">{hasPaperBadge(agent)}</td>
                  <td className="home-td-venue">
                    <span className="home-venue">{agent.paper.venue}</span>
                    <span className="home-year"> {agent.paper.year}</span>
                  </td>
                  <td className="home-td-score">
                    <span className="home-score" title={benchNotes}>
                      {score.length > 40 ? score.slice(0, 40) + '…' : score}
                    </span>
                  </td>
                  <td className="home-td-cov">
                    <span className="cov-chip cov-chip--covered">{covered}</span>
                    <div className="cov-bar-mini">
                      <div className="cov-bar-fill--covered" style={{ width: `${total > 0 ? (covered/total)*100 : 0}%` }} />
                    </div>
                  </td>
                  <td className="home-td-cov">
                    <span className="cov-chip cov-chip--partial">{partial}</span>
                  </td>
                  <td className="home-td-cov">
                    <span className="cov-chip cov-chip--nc">{notCovered}</span>
                  </td>
                  <td className="home-td-limit">
                    <span className="home-limit" title={allLimits}>
                      {firstLimit.length > 55 ? firstLimit.slice(0, 55) + '…' : firstLimit}
                    </span>
                  </td>
                  <td className="home-td-tags">
                    <div className="home-tags">
                      {agent.paper.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="home-tag">{tag}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
