import { useState, useEffect } from 'react'
import attackRaw from '../data/attack-enterprise.json'
import type { AttackData, PapersData } from '../types'

interface DataState {
  papers: PapersData | null
  attack: AttackData
  loading: boolean
  error: string | null
}

export function useData(): DataState {
  const [papers, setPapers] = useState<PapersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/papers.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<PapersData>
      })
      .then((data) => {
        setPapers(data)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  return { papers, attack: attackRaw as AttackData, loading, error }
}
