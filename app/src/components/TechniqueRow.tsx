import { getCoverage, isCovered } from '../utils/attack'
import type { Technique, Agent, CoverageLevel } from '../types'

interface Props {
  technique: Technique
  agent: Agent
}

const COVERAGE_LABELS: Record<CoverageLevel, string> = {
  'covered': 'Fully automated',
  'partial': 'Partially automated',
  'tool-dep': 'With external tool',
  'not-covered': 'Not covered',
}

export function TechniqueRow({ technique, agent }: Props) {
  const coverage = getCoverage(agent, technique.id)
  const covered = isCovered(agent, technique.id)
  const note = agent.techniques.find((t) => t.id === technique.id)?.notes

  return (
    <div className={`technique-row${covered ? ` covered coverage-${coverage}` : ''}`}>
      <div className="technique-main">
        <span className="tid">{technique.id}</span>
        <span className="tname">{technique.name}</span>
        {coverage && coverage !== 'not-covered' && (
          <span className={`coverage-dot coverage-dot--${coverage}`} />
        )}
        {covered && (
          <div className="evidence-card">
            <span className="evidence-label">{coverage ? COVERAGE_LABELS[coverage] : ''}</span>
            {note
              ? <p className="evidence-text">{note}</p>
              : <p className="evidence-text evidence-empty">No evidence notes recorded</p>
            }
          </div>
        )}
      </div>

      {technique.sub_techniques.length > 0 && (
        <div className="sub-list">
          {technique.sub_techniques.map((sub) => {
            const subCoverage = getCoverage(agent, sub.id)
            const subCovered = isCovered(agent, sub.id)
            const subNote = agent.techniques.find((t) => t.id === sub.id)?.notes
            return (
              <div key={sub.id} className={`sub-row${subCovered ? ` covered coverage-${subCoverage}` : ''}`}>
                <span className="tid">{sub.id}</span>
                <span className="tname">{sub.name}</span>
                {subCoverage && subCoverage !== 'not-covered' && (
                  <span className={`coverage-dot coverage-dot--${subCoverage}`} />
                )}
                {subCovered && (
                  <div className="evidence-card">
                    <span className="evidence-label">{subCoverage ? COVERAGE_LABELS[subCoverage] : ''}</span>
                    {subNote
                      ? <p className="evidence-text">{subNote}</p>
                      : <p className="evidence-text evidence-empty">No evidence notes recorded</p>
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
