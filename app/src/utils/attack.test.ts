import { describe, it, expect } from 'vitest'
import {
  getCoverage, isCovered, getCoveredIds,
  countCoveredInTactic, countPartialInTactic, countToolDepInTactic,
  buildOverviewMatrix,
} from './attack'
import type { Agent, Tactic } from '../types'

// Minimal agent fixture
const mockAgent: Agent = {
  id: 'test-agent',
  name: 'Test',
  has_paper: true,
  paper: {
    title: '', venue: '', year: 2025, authors: [], url: '',
    affiliation: '', summary: '', tags: [],
  },
  techniques: [
    { id: 'T1595', coverage: 'covered', notes: '' },
    { id: 'T1595.001', coverage: 'partial', notes: '' },
    { id: 'T1046', coverage: 'tool-dep', notes: '' },
    { id: 'T1082', coverage: 'not-covered', notes: '' },
  ],
}

const mockTactic: Tactic = {
  id: 'TA0043',
  name: 'Reconnaissance',
  shortname: 'reconnaissance',
  techniques: [
    {
      id: 'T1595', name: 'Active Scanning',
      sub_techniques: [
        { id: 'T1595.001', name: 'Scanning IP Blocks' },
        { id: 'T1595.002', name: 'Vulnerability Scanning' },
      ],
    },
    { id: 'T1592', name: 'Gather Host Info', sub_techniques: [] },
  ],
}

const mockTactic2: Tactic = {
  id: 'TA0007',
  name: 'Discovery',
  shortname: 'discovery',
  techniques: [
    { id: 'T1046', name: 'Network Service Discovery', sub_techniques: [] },
    { id: 'T1082', name: 'System Info Discovery', sub_techniques: [] },
  ],
}

describe('getCoverage', () => {
  it('returns coverage level for covered technique', () => {
    expect(getCoverage(mockAgent, 'T1595')).toBe('covered')
  })
  it('returns coverage level for partial technique', () => {
    expect(getCoverage(mockAgent, 'T1595.001')).toBe('partial')
  })
  it('returns coverage level for tool-dep technique', () => {
    expect(getCoverage(mockAgent, 'T1046')).toBe('tool-dep')
  })
  it('returns not-covered for explicitly not-covered technique', () => {
    expect(getCoverage(mockAgent, 'T1082')).toBe('not-covered')
  })
  it('returns undefined for technique not in list', () => {
    expect(getCoverage(mockAgent, 'T1999')).toBeUndefined()
  })
})

describe('isCovered', () => {
  it('returns true for covered', () => {
    expect(isCovered(mockAgent, 'T1595')).toBe(true)
  })
  it('returns true for partial', () => {
    expect(isCovered(mockAgent, 'T1595.001')).toBe(true)
  })
  it('returns true for tool-dep', () => {
    expect(isCovered(mockAgent, 'T1046')).toBe(true)
  })
  it('returns false for not-covered', () => {
    expect(isCovered(mockAgent, 'T1082')).toBe(false)
  })
  it('returns false for missing technique', () => {
    expect(isCovered(mockAgent, 'T1999')).toBe(false)
  })
})

describe('getCoveredIds', () => {
  it('returns set of active coverage IDs (excludes not-covered)', () => {
    const ids = getCoveredIds(mockAgent)
    expect(ids.has('T1595')).toBe(true)
    expect(ids.has('T1595.001')).toBe(true)
    expect(ids.has('T1046')).toBe(true)
    expect(ids.has('T1082')).toBe(false)   // not-covered excluded
    expect(ids.has('T1999')).toBe(false)   // not in list
  })
})

describe('countCoveredInTactic', () => {
  it('counts only fully-covered top-level techniques', () => {
    // T1595 = covered, T1592 = not in list
    expect(countCoveredInTactic(mockAgent, mockTactic)).toBe(1)
  })
  it('returns 0 when no techniques are fully covered', () => {
    // T1046 = tool-dep, T1082 = not-covered
    expect(countCoveredInTactic(mockAgent, mockTactic2)).toBe(0)
  })
})

describe('countPartialInTactic', () => {
  it('counts sub-techniques with partial when they are top-level in tactic', () => {
    // T1595.001 is a sub-technique, not a top-level in mockTactic — so 0
    expect(countPartialInTactic(mockAgent, mockTactic)).toBe(0)
  })
})

describe('countToolDepInTactic', () => {
  it('counts tool-dep top-level techniques', () => {
    // T1046 = tool-dep in mockTactic2
    expect(countToolDepInTactic(mockAgent, mockTactic2)).toBe(1)
  })
})

describe('buildOverviewMatrix', () => {
  it('produces one cell per agent×tactic', () => {
    const matrix = buildOverviewMatrix([mockAgent], [mockTactic, mockTactic2])
    expect(matrix).toHaveLength(2)
  })
  it('cell for TA0043 has coveredCount=1, partialCount=0, toolDepCount=0', () => {
    const matrix = buildOverviewMatrix([mockAgent], [mockTactic])
    const cell = matrix.find((c) => c.tacticId === 'TA0043')
    expect(cell?.coveredCount).toBe(1)
    expect(cell?.partialCount).toBe(0)
    expect(cell?.toolDepCount).toBe(0)
  })
  it('cell for TA0007 has coveredCount=0, toolDepCount=1', () => {
    const matrix = buildOverviewMatrix([mockAgent], [mockTactic2])
    const cell = matrix.find((c) => c.tacticId === 'TA0007')
    expect(cell?.coveredCount).toBe(0)
    expect(cell?.toolDepCount).toBe(1)
  })
})
