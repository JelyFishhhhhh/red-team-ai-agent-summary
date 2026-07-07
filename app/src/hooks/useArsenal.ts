import { useState, useEffect } from 'react'
import type { ArsenalData } from '../types'

export function useArsenal() {
  const [arsenal, setArsenal] = useState<ArsenalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/arsenal.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ArsenalData> })
      .then((d) => { setArsenal(d); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [])
  return { arsenal, loading, error }
}
