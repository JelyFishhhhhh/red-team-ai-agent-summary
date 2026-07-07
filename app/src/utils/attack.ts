import type { Tactic, OverviewCell, CoverageLevel, TechniqueMapping } from '../types'

/** Anything with a rubric-labeled technique list — Agent and ArsenalItem both satisfy this. */
type HasTechniques = { techniques: TechniqueMapping[] }

/** Get the coverage level for a technique ID, or undefined if not in the list */
export function getCoverage(agent: HasTechniques, techniqueId: string): CoverageLevel | undefined {
  return agent.techniques.find((t) => t.id === techniqueId)?.coverage
}

/** Returns true if there is any coverage (covered/partial/tool-dep) — NOT 'not-covered' */
export function isCovered(agent: HasTechniques, techniqueId: string): boolean {
  const level = getCoverage(agent, techniqueId)
  return level !== undefined && level !== 'not-covered'
}

/** Returns a Set of all technique IDs that have any active coverage */
export function getCoveredIds(agent: HasTechniques): Set<string> {
  return new Set(
    agent.techniques
      .filter((t) => t.coverage !== 'not-covered')
      .map((t) => t.id)
  )
}

/** Count top-level techniques in a tactic that have coverage = 'covered' (not partial/tool-dep) */
export function countCoveredInTactic(agent: HasTechniques, tactic: Tactic): number {
  return tactic.techniques.filter(
    (t) => getCoverage(agent, t.id) === 'covered'
  ).length
}

/** Count top-level techniques in a tactic with coverage = 'partial' */
export function countPartialInTactic(agent: HasTechniques, tactic: Tactic): number {
  return tactic.techniques.filter(
    (t) => getCoverage(agent, t.id) === 'partial'
  ).length
}

/** Count top-level techniques in a tactic with coverage = 'tool-dep' */
export function countToolDepInTactic(agent: HasTechniques, tactic: Tactic): number {
  return tactic.techniques.filter(
    (t) => getCoverage(agent, t.id) === 'tool-dep'
  ).length
}

export interface TechniqueInfo {
  id: string
  name: string
  coverage: CoverageLevel
  notes: string
}

/** Get all actively-covered techniques + sub-techniques in a tactic for tooltip display */
export function getCoveredTechniquesInTactic(agent: HasTechniques, tactic: Tactic): TechniqueInfo[] {
  const results: TechniqueInfo[] = []
  for (const tech of tactic.techniques) {
    const mapping = agent.techniques.find((t) => t.id === tech.id)
    if (mapping && mapping.coverage !== 'not-covered') {
      results.push({ id: tech.id, name: tech.name, coverage: mapping.coverage, notes: mapping.notes })
    }
    for (const sub of tech.sub_techniques) {
      const subMapping = agent.techniques.find((t) => t.id === sub.id)
      if (subMapping && subMapping.coverage !== 'not-covered') {
        results.push({ id: sub.id, name: sub.name, coverage: subMapping.coverage, notes: subMapping.notes })
      }
    }
  }
  return results
}

/** Build overview matrix: one OverviewCell per item×tactic combination */
export function buildOverviewMatrix(
  agents: (HasTechniques & { id: string })[],
  tactics: Tactic[],
): OverviewCell[] {
  const cells: OverviewCell[] = []
  for (const agent of agents) {
    for (const tactic of tactics) {
      cells.push({
        agentId: agent.id,
        tacticId: tactic.id,
        coveredCount: countCoveredInTactic(agent, tactic),
        partialCount: countPartialInTactic(agent, tactic),
        toolDepCount: countToolDepInTactic(agent, tactic),
      })
    }
  }
  return cells
}
