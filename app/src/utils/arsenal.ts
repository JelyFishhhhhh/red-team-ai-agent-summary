import type { ArsenalItem, Tactic, ItemKind } from '../types'
import { countCoveredInTactic, countPartialInTactic, countToolDepInTactic } from './attack'

export interface ArsenalRow {
  id: string; name: string; kind: ItemKind; category: string
  stars: number; autonomy: string; language: string
  tacticSpan: number; covered: number; partial: number; toolDep: number
}

export function toRow(item: ArsenalItem, tactics: Tactic[]): ArsenalRow {
  let covered = 0, partial = 0, toolDep = 0, tacticSpan = 0
  for (const t of tactics) {
    const c = countCoveredInTactic(item, t)
    const p = countPartialInTactic(item, t)
    const d = countToolDepInTactic(item, t)
    if (c + p + d > 0) tacticSpan++
    covered += c; partial += p; toolDep += d
  }
  return {
    id: item.id, name: item.name, kind: item.kind, category: item.category,
    stars: item.stars, autonomy: item.autonomy ?? '—', language: item.language ?? '—',
    tacticSpan, covered, partial, toolDep,
  }
}
