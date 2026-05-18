import { useState, useEffect, useCallback } from 'react'
import { AgentList } from './components/AgentList'
import { PaperForm } from './components/PaperForm'
import { TechniqueSelector } from './components/TechniqueSelector'
import type { PapersData, Agent, AttackData } from './types'

type TabId = 'paper' | 'techniques'
type SaveStatus = { type: 'idle' } | { type: 'saving' } | { type: 'ok' } | { type: 'err'; msg: string }

function makeBlankAgent(): Agent {
  return {
    id: 'new-agent-' + Date.now(),
    name: 'New Agent',
    has_paper: false,
    paper: {
      title: '', venue: '', year: new Date().getFullYear(),
      authors: [], arxiv: '', url: '', affiliation: '', summary: '', tags: [],
    },
    techniques: [],
  }
}

export default function App() {
  const [papers, setPapers] = useState<PapersData | null>(null)
  const [attack, setAttack] = useState<AttackData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('paper')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ type: 'idle' })

  useEffect(() => {
    fetch('/api/papers').then((r) => r.json()).then(setPapers)
    fetch('/api/attack').then((r) => r.json()).then(setAttack)
  }, [])

  const selectedAgent = papers?.agents.find((a) => a.id === selectedId) ?? null

  function updateAgent(updated: Agent) {
    if (!papers) return
    setPapers({
      ...papers,
      agents: papers.agents.map((a) => (a.id === updated.id ? updated : a)),
    })
  }

  function addAgent() {
    if (!papers) return
    const blank = makeBlankAgent()
    setPapers({ ...papers, agents: [...papers.agents, blank] })
    setSelectedId(blank.id)
  }

  function deleteAgent(id: string) {
    if (!papers) return
    if (!confirm(`Delete agent "${id}"?`)) return
    setPapers({ ...papers, agents: papers.agents.filter((a) => a.id !== id) })
    setSelectedId(null)
  }

  const save = useCallback(async () => {
    if (!papers) return
    setSaveStatus({ type: 'saving' })
    try {
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(papers),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaveStatus({ type: 'ok' })
      setTimeout(() => setSaveStatus({ type: 'idle' }), 2000)
    } catch (e: unknown) {
      setSaveStatus({ type: 'err', msg: e instanceof Error ? e.message : String(e) })
    }
  }, [papers])

  if (!papers || !attack) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8b949e' }}>Loading...</div>
  }

  return (
    <div className="editor-shell">
      <AgentList
        agents={papers.agents}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addAgent}
        onDelete={deleteAgent}
      />

      <div className="editor-main">
        <div className="editor-topbar">
          <h1>RedTeam AI Editor</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saveStatus.type === 'ok' && <span className="save-status ok">Saved ✓</span>}
            {saveStatus.type === 'err' && <span className="save-status err">Error: {saveStatus.msg}</span>}
            <button className="btn-save" onClick={save} disabled={saveStatus.type === 'saving'}>
              {saveStatus.type === 'saving' ? 'Saving…' : 'Save to papers.json'}
            </button>
          </div>
        </div>

        {selectedAgent ? (
          <>
            <div className="editor-tabs">
              <button className={`editor-tab${tab === 'paper' ? ' active' : ''}`} onClick={() => setTab('paper')}>Paper Info</button>
              <button className={`editor-tab${tab === 'techniques' ? ' active' : ''}`} onClick={() => setTab('techniques')}>
                Techniques ({selectedAgent.techniques.length})
              </button>
            </div>

            <div className="editor-content">
              {tab === 'paper' && <PaperForm agent={selectedAgent} onChange={updateAgent} />}
              {tab === 'techniques' && (
                <TechniqueSelector agent={selectedAgent} attack={attack} onChange={updateAgent} />
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
            Select an agent from the sidebar to edit
          </div>
        )}
      </div>
    </div>
  )
}
