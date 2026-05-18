// ATT&CK data types (from attack-enterprise.json)
export interface SubTechnique {
  id: string   // e.g. "T1595.001"
  name: string
}

export interface Technique {
  id: string              // e.g. "T1595"
  name: string
  sub_techniques: SubTechnique[]
}

export interface Tactic {
  id: string              // e.g. "TA0043"
  name: string
  shortname: string
  techniques: Technique[]
}

export interface AttackData {
  version: string
  tactics: Tactic[]
}

// Coverage enum matching actual papers.json values
export type CoverageLevel = 'covered' | 'partial' | 'tool-dep' | 'not-covered'

// Technique mapping — matches actual papers.json schema
export interface TechniqueMapping {
  id: string              // technique or sub-technique ID (e.g. "T1595" or "T1003.001")
  coverage: CoverageLevel
  notes: string
}

// Paper metadata
export interface Paper {
  title: string
  venue: string
  year: number
  authors: string[]
  arxiv?: string          // may be empty string "" or omitted
  url: string
  affiliation: string
  summary: string
  tags: string[]
}

// Benchmark info (from papers.json)
export interface Benchmark {
  dataset: string
  score: string
  notes: string
}

// Agent — matches actual papers.json schema
export interface Agent {
  id: string
  name: string
  has_paper: boolean
  paper: Paper
  benchmark?: Benchmark
  limitations?: string[]
  techniques: TechniqueMapping[]
}

// Top-level papers.json structure
// Note: "tools" key exists at root level (currently always [])
export interface PapersData {
  version: string
  lastUpdated: string
  agents: Agent[]
  tools: unknown[]        // present in schema as empty array; type TBD
}

// Derived types for UI
export type CoverageStatus = CoverageLevel | 'none'   // 'none' = not in agent's list at all

export interface OverviewCell {
  agentId: string
  tacticId: string
  coveredCount: number      // techniques with coverage = 'covered'
  partialCount: number      // techniques with coverage = 'partial'
  toolDepCount: number      // techniques with coverage = 'tool-dep'
}
