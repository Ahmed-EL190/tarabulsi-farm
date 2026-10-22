import { collection, query, where, getAggregateFromServer, sum } from 'firebase/firestore'
import { db } from '../firebase/config'
import { COL } from './collections'
/** Server-side sums over ALL non-archived cashbook rows (no 1000-row limit). */
export async function allTimeCash() {
  const q = query(collection(db, COL.milk), where('archived', '==', false))
  const d = (await getAggregateFromServer(q, { rSYP: sum('receiptsSYP'), pSYP: sum('paymentsSYP'), rUSD: sum('receiptsUSD'), pUSD: sum('paymentsUSD') })).data()
  return { SYP: { receipts: d.rSYP || 0, payments: d.pSYP || 0 }, USD: { receipts: d.rUSD || 0, payments: d.pUSD || 0 } }
}
