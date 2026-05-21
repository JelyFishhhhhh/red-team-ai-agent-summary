import { getCoverage } from '../utils/attack'
import type { Technique, Agent, CoverageLevel } from '../types'

interface Props {
  technique: Technique
  agent: Agent
}

const COVERAGE_LABEL: Record<CoverageLevel, string> = {
  'covered':     'Covered',
  'partial':     'Partial',
  'tool-dep':    'Tool-dep',
  'not-covered': 'Not covered',
}

const COVERAGE_SHORT: Record<CoverageLevel, string> = {
  'covered':     'C',
  'partial':     'P',
  'tool-dep':    'T',
  'not-covered': 'N',
}

const TIER_DESC: Record<string, string> = {
  'T1': 'Direct paper/doc citation',
  'T2': 'Official docs / GitHub',
  'T3': 'Case study / blog post',
  'T4': 'Inferred from behavior',
}

function hasMapping(agent: Agent, id: string) {
  return agent.techniques.some((t) => t.id === id)
}

function EvidenceCard({ coverage, notes, source }: {
  coverage: CoverageLevel
  notes: string
  source?: { tier: string; ref: string }
}) {
  return (
    <div className="evidence-card">
      <div className="evidence-header">
        <span className={`coverage-badge coverage-badge--${coverage}`}>
          {COVERAGE_SHORT[coverage]} — {COVERAGE_LABEL[coverage]}
        </span>
        {source?.tier && (
          <span className="tier-badge" title={TIER_DESC[source.tier] ?? source.tier}>
            {source.tier}
          </span>
        )}
      </div>
      {source?.ref && (
        <p className="evidence-ref">{source.ref}</p>
      )}
      {notes && (
        <p className="evidence-text">{notes}</p>
      )}
      {!notes && !source?.ref && (
        <p className="evidence-text evidence-empty">No evidence notes recorded</p>
      )}
    </div>
  )
}

export function TechniqueRow({ technique, agent }: Props) {
  const coverage = getCoverage(agent, technique.id)
  const mapping = agent.techniques.find((t) => t.id === technique.id)
  const hasMap = hasMapping(agent, technique.id)

  return (
    <div className={`technique-row${coverage && coverage !== 'not-covered' ? ` covered coverage-${coverage}` : ''}`}>
      <div className="technique-main">
        <span className="tid">{technique.id}</span>
        <span className="tname">{technique.name}</span>
        {hasMap && coverage && (
          <>
            <span className={`coverage-badge coverage-badge--${coverage}`}>
              {COVERAGE_SHORT[coverage]}
            </span>
            {mapping?.source?.tier && (
              <span className="tier-badge" title={TIER_DESC[mapping.source.tier] ?? mapping.source.tier}>
                {mapping.source.tier}
              </span>
            )}
            <EvidenceCard
              coverage={coverage}
              notes={mapping?.notes ?? ''}
              source={mapping?.source}
            />
          </>
        )}
      </div>

      {technique.sub_techniques.length > 0 && (
        <div className="sub-list">
          {technique.sub_techniques.map((sub) => {
            const subCoverage = getCoverage(agent, sub.id)
            const subMapping = agent.techniques.find((t) => t.id === sub.id)
            const subHasMap = hasMapping(agent, sub.id)
            return (
              <div key={sub.id} className={`sub-row${subCoverage && subCoverage !== 'not-covered' ? ` covered coverage-${subCoverage}` : ''}`}>
                <span className="tid">{sub.id}</span>
                <span className="tname">{sub.name}</span>
                {subHasMap && subCoverage && (
                  <>
                    <span className={`coverage-badge coverage-badge--${subCoverage}`}>
                      {COVERAGE_SHORT[subCoverage]}
                    </span>
                    {subMapping?.source?.tier && (
                      <span className="tier-badge" title={TIER_DESC[subMapping.source.tier] ?? subMapping.source.tier}>
                        {subMapping.source.tier}
                      </span>
                    )}
                    <EvidenceCard
                      coverage={subCoverage}
                      notes={subMapping?.notes ?? ''}
                      source={subMapping?.source}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
