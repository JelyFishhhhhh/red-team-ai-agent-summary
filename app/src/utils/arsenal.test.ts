import { describe, it, expect } from 'vitest'
import { toRow } from './arsenal'
import type { ArsenalItem, Tactic } from '../types'

const tactics: Tactic[] = [
  { id: 'TA0043', name: 'Recon', shortname: 'reconnaissance', techniques: [{ id: 'T1595', name: 'Active Scanning', sub_techniques: [] }] },
  { id: 'TA0002', name: 'Execution', shortname: 'execution', techniques: [{ id: 'T1059', name: 'Cmd', sub_techniques: [] }] },
]
const item = {
  id: 'x', kind: 'tool', category: 'recon', name: 'X', stars: 3, autonomy: null, language: 'Go',
  techniques: [
    { id: 'T1595', coverage: 'tool-dep', notes: '', source: { tier: 'T2', ref: 'r' } },
    { id: 'T1059', coverage: 'covered', notes: '', source: { tier: 'T2', ref: 'r' } },
  ],
} as unknown as ArsenalItem

describe('toRow', () => {
  it('counts coverage + tactic span', () => {
    const row = toRow(item, tactics)
    expect(row.covered).toBe(1)
    expect(row.toolDep).toBe(1)
    expect(row.tacticSpan).toBe(2)
  })
})
