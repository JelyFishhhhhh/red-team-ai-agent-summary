import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useData } from './hooks/useData'
import { OverviewMatrix } from './components/OverviewMatrix'
import { CoverageDepth } from './components/CoverageDepth'
import { GapRoadmap } from './components/GapRoadmap'
import { AttackChainDemo } from './components/AttackChainDemo'
import { KgSchema } from './components/KgSchema'
import { HomePage } from './pages/HomePage'
import { AgentPage } from './pages/AgentPage'

export default function App() {
  const { papers, attack, loading, error } = useData()
  const navigate = useNavigate()

  if (loading) return <div className="app-loading">Loading ATT&amp;CK data…</div>
  if (error || !papers) return <div className="app-error">Error: {error ?? 'No data'}</div>

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="topbar-logo">
          RedTeam AI <span className="topbar-logo-sub">× MITRE ATT&amp;CK Enterprise</span>
        </NavLink>
        <nav className="topbar-nav">
          <NavLink to="/" end className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/overview" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
            Overview Matrix
          </NavLink>
          <NavLink to="/analysis" className={({ isActive }) => `topbar-link topbar-link--accent${isActive ? ' active' : ''}`}>
            Depth Analysis
          </NavLink>
          <NavLink to="/gap-roadmap" className={({ isActive }) => `topbar-link topbar-link--accent${isActive ? ' active' : ''}`}>
            Gap Roadmap
          </NavLink>
          <NavLink to="/kg-schema" className={({ isActive }) => `topbar-link topbar-link--accent${isActive ? ' active' : ''}`}>
            KG Schema
          </NavLink>
          <NavLink to="/attack-chain" className={({ isActive }) => `topbar-link topbar-link--accent${isActive ? ' active' : ''}`}>
            Attack Chain Demo
          </NavLink>
        </nav>
      </header>

      <nav className="agent-tabs" role="tablist" aria-label="Agent selection">
        {papers.agents.map((agent) => (
          <NavLink
            key={agent.id}
            to={`/${agent.id}`}
            className={({ isActive }) => `agent-tab${isActive ? ' active' : ''}`}
          >
            {agent.name}
          </NavLink>
        ))}
      </nav>

      <div className="main-body">
        <Routes>
          <Route path="/" element={<HomePage agents={papers.agents} />} />
          <Route
            path="/overview"
            element={
              <OverviewMatrix
                agents={papers.agents}
                tactics={attack.tactics}
                onSelectAgent={(id) => navigate(`/${id}`)}
              />
            }
          />
          <Route
            path="/analysis"
            element={
              <CoverageDepth
                agents={papers.agents}
                tactics={attack.tactics}
                onSelectAgent={(id) => navigate(`/${id}`)}
              />
            }
          />
          <Route
            path="/gap-roadmap"
            element={
              <GapRoadmap
                agents={papers.agents}
                tactics={attack.tactics}
              />
            }
          />
          <Route path="/kg-schema" element={<KgSchema />} />
          <Route path="/attack-chain" element={<AttackChainDemo />} />
          <Route
            path="/:agentId"
            element={<AgentPage papers={papers} attack={attack} />}
          />
        </Routes>
      </div>
    </div>
  )
}
