import { useState, useCallback } from 'react'

export type SortDir = 'asc' | 'desc' | null

export interface SortState<K extends string> {
  key: K | null
  dir: SortDir
}

export function useSort<K extends string>(defaultKey?: K, defaultDir: SortDir = 'asc') {
  const [sort, setSort] = useState<SortState<K>>({
    key: defaultKey ?? null,
    dir: defaultKey ? defaultDir : null,
  })

  const toggle = useCallback((key: K) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc')  return { key, dir: 'desc' }
      return { key: null, dir: null }   // third click resets
    })
  }, [])

  return { sort, toggle }
}

/** Apply sort to an array given a value extractor. */
export function applySortFn<T, K extends string>(
  items: T[],
  sort: SortState<K>,
  getValue: (item: T, key: K) => string | number
): T[] {
  if (!sort.key || !sort.dir) return items
  const key = sort.key
  const dir = sort.dir
  return [...items].sort((a, b) => {
    const va = getValue(a, key)
    const vb = getValue(b, key)
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va
    }
    const sa = String(va).toLowerCase()
    const sb = String(vb).toLowerCase()
    const cmp = sa < sb ? -1 : sa > sb ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}
