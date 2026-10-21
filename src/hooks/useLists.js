import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { DEFAULT_LISTS } from '../utils/defaults'

/** settings/lists = { [key]: { items: string[], disabled: string[] } }. Falls back to workbook defaults. */
export function mergeLists(stored = {}) {
  const out = {}
  for (const k of Object.keys(DEFAULT_LISTS)) {
    const s = stored[k]; const items = s?.items?.length ? s.items : DEFAULT_LISTS[k]
    out[k] = { items, disabled: s?.disabled || [], active: items.filter((i) => !(s?.disabled || []).includes(i)) }
  }
  return out
}
export function useLists() {
  const [stored, setStored] = useState({})
  useEffect(() => onSnapshot(doc(db, 'settings', 'lists'), (d) => setStored(d.data() || {}), () => {}), [])
  return mergeLists(stored)
}
