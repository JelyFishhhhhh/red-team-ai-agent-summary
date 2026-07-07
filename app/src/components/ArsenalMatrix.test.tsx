import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ArsenalMatrix } from './ArsenalMatrix'
import { ArsenalItemDetail } from './ArsenalItemDetail'
import type { ArsenalItem, Tactic } from '../types'

const tactics: Tactic[] = [{ id: 'TA0043', name: 'Reconnaissance', shortname: 'reconnaissance', techniques: [{ id: 'T1595', name: 'Active Scanning', sub_techniques: [] }] }]
const items = [{ id: 'nmap', repo: '', name: 'nmap', url: '', stars: 9, language: 'C', kind: 'tool', category: 'recon', description: 'scanner', topics: [], autonomy: null, has_paper: false, benchmark: null, techniques: [{ id: 'T1595', coverage: 'tool-dep', notes: 'scans', source: { tier: 'T2', ref: 'r' } }] }] as unknown as ArsenalItem[]

describe('Arsenal matrix + detail', () => {
  it('matrix renders item row', () => {
    render(<ArsenalMatrix items={items} tactics={tactics} />)
    expect(screen.getByText('nmap')).toBeInTheDocument()
  })
  it('detail renders covered technique', () => {
    render(<ArsenalItemDetail item={items[0]} tactics={tactics} />)
    expect(screen.getByText('T1595')).toBeInTheDocument()
  })
})
