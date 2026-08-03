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

// Evidence source for a technique mapping
export interface TechniqueSource {
  tier: string    // T1 = paper citation, T2 = official docs, T3 = case study, T4 = inferred
  ref: string     // human-readable citation
}

// Technique mapping — matches actual papers.json schema
export interface TechniqueMapping {
  id: string              // technique or sub-technique ID (e.g. "T1595" or "T1003.001")
  coverage: CoverageLevel
  notes: string
  source?: TechniqueSource
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

// --- Two-axis taxonomy (design intent x evaluation target), added 2026-08-03 ---
// Deliberately NOT single- vs multi-agent: that describes implementation, not
// research position, and cannot explain why post-exploitation is uncovered.

export type TaxonomyGroup = 'G1' | 'G2' | 'G3' | 'G4'

// Whether the post-exploitation phase could have been measured at all.
export type PostExMeasured =
  | 'yes'                          // multi-host / AD target — it was measurable
  | 'no-target'                    // benchmark has no such phase
  | 'claimed-unmeasured'           // claimed, but no public measurement
  | 'out-of-scope-by-definition'   // task ends at a single proven vulnerability

// Why this backend was chosen — it tracks the research goal, not the state of the art.
export type ModelStance =
  | 'capability-first'   // strongest closed model, to show it CAN be done
  | 'cost-first'         // open weights on purpose, to show frontier is NOT required
  | 'model-as-subject'   // sweeps backends; the model is the independent variable
  | 'byo-llm'            // repo-only product: the model is the user's choice
  | 'not-disclosed'

// Attribution for the absence of post-exploitation coverage.
// null where this agent was not individually adjudicated.
export type Bottleneck = 'B1' | 'B2' | 'B3' | 'measured' | null

export interface AgentClassification {
  group: TaxonomyGroup
  group_label: string
  design_intent: string
  eval_target: string
  postex_measured: PostExMeasured
  model_stance: ModelStance
  primary_model: string
  // 'n/a' for repo-only projects: a hardcoded default is not an experimental model,
  // so these must NOT be pooled with the paper-backed group.
  param_count: 'available' | 'unavailable' | 'partial' | 'mixed' | 'unknown' | 'n/a'
  bottleneck: Bottleneck
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
  classification?: AgentClassification
}

// Top-level papers.json structure
// Note: "tools" key exists at root level (currently always [])
export interface PapersData {
  version: string
  lastUpdated: string
  agents: Agent[]
  tools: never[]          // present in schema as always-empty array; element type undefined
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

// --- Starred Arsenal (starred red-team/AI repos, coverage-scored) ---

export type ItemKind = 'ai-agent' | 'agent-framework' | 'tool' | 'lab-dataset'

// Superset of Agent + tool schemas so one render path handles all.
export interface ArsenalItem {
  id: string
  repo: string
  name: string
  url: string
  stars: number
  language: string | null
  kind: ItemKind
  category: string
  description: string
  topics: string[]
  autonomy: 'L1' | 'L2' | 'L3' | null   // null for pure tools
  has_paper: boolean
  techniques: TechniqueMapping[]         // reuses rubric-labeled mapping
  benchmark: Benchmark | null
}

export interface ArsenalData {
  version: string
  lastUpdated: string
  items: ArsenalItem[]
}
