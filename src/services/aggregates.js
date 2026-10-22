import { collection, query, where, getAggregateFromServer, getDocs, sum } from 'firebase/firestore'
import { db } from '../firebase/config'
import { COL } from './collections'

const FIELDS = ['receiptsSYP', 'paymentsSYP', 'receiptsUSD', 'paymentsUSD']
const pack = ([rSYP, pSYP, rUSD, pUSD]) => ({ SYP: { receipts: rSYP, payments: pSYP }, USD: { receipts: rUSD, payments: pUSD } })

/**
 * Sums over ALL non-archived cashbook rows.
 * 1) Server-side aggregation (needs the (archived, field) indexes to be Enabled).
 * 2) Fallback if an index is missing/building: read the rows and sum on the client (equality filter only, no index needed).
 */
export async function allTimeCash() {
  const q = query(collection(db, COL.milk), where('archived', '==', false))
  try {
    const one = async (f) => (await getAggregateFromServer(q, { s: sum(f) })).data().s || 0
    return pack(await Promise.all(FIELDS.map(one)))
  } catch (e) {
    if (e?.code !== 'failed-precondition') throw e
    const t = [0, 0, 0, 0]
    ;(await getDocs(q)).forEach((d) => { const r = d.data(); FIELDS.forEach((f, i) => { t[i] += Number(r[f]) || 0 }) })
    return pack(t)
  }
}