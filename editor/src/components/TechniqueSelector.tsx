import { useState } from 'react'
import type { Agent, AttackData, TechniqueMapping, CoverageLevel } from '../types'

interface Props {
  agent: Agent
  attack: AttackData
  onChange: (updated: Agent) => void
}

const COVERAGE_OPTIONS: CoverageLevel[] = ['covered', 'partial', 'tool-dep', 'not-covered']

export function TechniqueSelector({ agent, attack, onChange }: Props) {
  const [openTactics, setOpenTactics] = useState<Set<string>>(new Set())

  function toggleTactic(id: string) {
    setOpenTactics((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getMapping(id: string): TechniqueMapping | undefined {
    return agent.techniques.find((t) => t.id === id)
  }

  function isCovered(id: string) {
    return agent.techniques.some((t) => t.id === id)
  }

  function toggleTechnique(id: string) {
    const existing = getMapping(id)
    let updated: TechniqueMapping[]
    if (existing) {
      updated = agent.techniques.filter((t) => t.id !== id)
    } else {
      updated = [...agent.techniques, { id, coverage: 'covered', notes: '' }]
    }
    onChange({ ...agent, techniques: updated })
  }

  function updateCoverage(id: string, coverage: CoverageLevel) {
    const updated = agent.techniques.map((t) =>
      t.id === id ? { ...t, coverage } : t
    )
    onChange({ ...agent, techniques: updated })
  }

  function updateNotes(id: string, notes: string) {
    const updated = agent.techniques.map((t) =>
      t.id === id ? { ...t, notes } : t
    )
    onChange({ ...agent, techniques: updated })
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {agent.techniques.length} techniques selected. Click to toggle. Edit notes inline.
      </div>
      {attack.tactics.map((tactic) => {
        const isOpen = openTactics.has(tactic.id)
        const coveredCount = tactic.techniques.filter((t) => isCovered(t.id)).length
        return (
          <div key={tactic.id} className="tech-selector-tactic">
            <button
              className="tech-selector-tactic-header"
              onClick={() => toggleTactic(tactic.id)}
            >
              <span className="tid">{tactic.id}</span>
              <span style={{ flex: 1 }}>{tactic.name}</span>
              <span style={{ fontSize: 11, background: coveredCount > 0 ? '#3fb95022' : '#58a6ff15', color: coveredCount > 0 ? 'var(--green)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 10 }}>
                {coveredCount} covered
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div style={{ paddingLeft: 8 }}>
                {tactic.techniques.map((tech) => {
                  const mapping = getMapping(tech.id)
                  const covered = !!mapping
                  return (
                    <div key={tech.id}>
                      <div
                        className={`tech-row-selector${covered ? ' covered' : ''}`}
                        onClick={() => toggleTechnique(tech.id)}
                      >
                        <input
                          type="checkbox"
                          checked={covered}
                          onChange={() => toggleTechnique(tech.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="tid">{tech.id}</span>
                        <span style={{ flex: 1 }}>{tech.name}</span>
                        {covered && (
                          <>
                            <select
                              className="coverage-select"
                              value={mapping!.coverage}
                              onChange={(e) => updateCoverage(tech.id, e.target.value as CoverageLevel)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {COVERAGE_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                            <input
                              className="notes-input"
                              placeholder="notes..."
                              value={mapping!.notes}
                              onChange={(e) => updateNotes(tech.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        )}
                      </div>
                      {tech.sub_techniques.map((sub) => {
                        const subMapping = getMapping(sub.id)
                        const subCovered = !!subMapping
                        return (
                          <div
                            key={sub.id}
                            className={`sub-row-selector${subCovered ? ' covered' : ''}`}
                            onClick={() => toggleTechnique(sub.id)}
                          >
                            <input
                              type="checkbox"
                              checked={subCovered}
                              onChange={() => toggleTechnique(sub.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="tid">{sub.id}</span>
                            <span style={{ flex: 1 }}>{sub.name}</span>
                            {subCovered && (
                              <>
                                <select
                                  className="coverage-select"
                                  value={subMapping!.coverage}
                                  onChange={(e) => updateCoverage(sub.id, e.target.value as CoverageLevel)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {COVERAGE_OPTIONS.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                                <input
                                  className="notes-input"
                                  placeholder="notes..."
                                  value={subMapping!.notes}
                                  onChange={(e) => updateNotes(sub.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
