import { getCoveredIds } from '../utils/attack'
import type { Agent, AttackData } from '../types'

interface Props {
  agent: Agent
  attack: AttackData
}

export function PaperSidebar({ agent, attack }: Props) {
  const coveredIds = getCoveredIds(agent)

  const coveredTactics = attack.tactics.filter((tactic) =>
    tactic.techniques.some((t) => coveredIds.has(t.id))
  )

  const totalCount = agent.techniques.filter((t) => t.coverage !== 'not-covered').length
  const coveredFull = agent.techniques.filter((t) => t.coverage === 'covered').length
  const partial = agent.techniques.filter((t) => t.coverage === 'partial').length
  const toolDep = agent.techniques.filter((t) => t.coverage === 'tool-dep').length

  return (
    <aside className="paper-sidebar">
      <div className="sidebar-title">Paper Info</div>

      <div className="paper-card">
        <h3 className="paper-title">{agent.paper.title}</h3>
        <div className="paper-venue">{agent.paper.venue} · {agent.paper.affiliation}</div>
        <div className="paper-meta">
          {agent.paper.authors.join(', ')}<br />
          {agent.paper.year}
          {agent.paper.arxiv && (
            <> · <a
              href={`https://arxiv.org/abs/${agent.paper.arxiv}`}
              target="_blank"
              rel="noreferrer"
              className="paper-link"
            >arXiv:{agent.paper.arxiv}</a></>
          )}
        </div>
        <div className="paper-tags">
          {agent.paper.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        <p className="paper-summary">{agent.paper.summary}</p>
      </div>

      {agent.benchmark && (
        <>
          <div className="sidebar-section-title">Benchmark</div>
          <div className="paper-card">
            <div className="paper-meta" style={{ fontSize: '11px' }}>
              <strong>{agent.benchmark.score}</strong><br />
              {agent.benchmark.dataset}<br />
              {agent.benchmark.notes && <em>{agent.benchmark.notes}</em>}
            </div>
          </div>
        </>
      )}

      <div className="sidebar-section-title">ATT&amp;CK Coverage</div>
      <div className="coverage-stats">
        <div className="stat-box">
          <div className="stat-num" style={{ color: 'var(--accent-green)' }}>{coveredFull}</div>
          <div className="stat-label">Covered</div>
        </div>
        <div className="stat-box">
          <div className="stat-num" style={{ color: 'var(--accent-orange)' }}>{partial}</div>
          <div className="stat-label">Partial</div>
        </div>
        <div className="stat-box">
          <div className="stat-num" style={{ color: 'var(--accent-blue)' }}>{toolDep}</div>
          <div className="stat-label">Tool-dep</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{coveredTactics.length}</div>
          <div className="stat-label">Tactics</div>
        </div>
      </div>

      {agent.limitations && agent.limitations.length > 0 && (
        <>
          <div className="sidebar-section-title">Limitations</div>
          <ul className="limitations-list">
            {agent.limitations.map((lim, i) => (
              <li key={i} className="limitation-item">{lim}</li>
            ))}
          </ul>
        </>
      )}

      <div className="sidebar-section-title">Covered Tactics</div>
      <div className="covered-tactics-list">
        {coveredTactics.map((t) => (
          <div key={t.id} className="covered-tactic-item">
            <span className="tactic-id-small">{t.id}</span>
            <span>{t.name}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
