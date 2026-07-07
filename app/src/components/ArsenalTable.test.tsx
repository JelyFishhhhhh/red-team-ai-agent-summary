import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { ArsenalTable } from './ArsenalTable'
import type { ArsenalItem, Tactic } from '../types'

const tactics: Tactic[] = [{ id: 'TA0043', name: 'Recon', shortname: 'reconnaissance', techniques: [{ id: 'T1595', name: 'AS', sub_techniques: [] }] }]
const items = [{ id: 'nmap', name: 'nmap', kind: 'tool', category: 'recon', stars: 9, autonomy: null, language: 'C', techniques: [{ id: 'T1595', coverage: 'tool-dep', notes: '', source: { tier: 'T2', ref: 'r' } }] }] as unknown as ArsenalItem[]

describe('ArsenalTable', () => {
  it('renders a row per item', () => {
    render(<MemoryRouter><ArsenalTable items={items} tactics={tactics} /></MemoryRouter>)
    expect(screen.getByText('nmap')).toBeInTheDocument()
  })
})
