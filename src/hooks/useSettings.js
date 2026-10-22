import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
/** settings/general = { openingCash: { SYP, USD }, openingCashDate } */
export function useSettings() {
  const [s, setS] = useState({ openingCash: { SYP: 0, USD: 0 } })
  useEffect(() => onSnapshot(doc(db, 'settings', 'general'), (d) => setS({ openingCash: { SYP: 0, USD: 0 }, ...(d.data() || {}) }), () => {}), [])
  return s
}
