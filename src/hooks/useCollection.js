import { useEffect, useState } from 'react'
import { watch } from '../services/db'
export function useCollection(col, opts) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null)
  useEffect(() => {
    setLoading(true)
    return watch(col, (r, e) => { setRows(r); setError(e || null); setLoading(false) }, opts)
  }, [col, opts?.from, opts?.to])
  return { rows, loading, error }
}
