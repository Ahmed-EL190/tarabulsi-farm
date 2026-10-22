
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { COL } from './collections'

const FIELDS = ['receiptsSYP', 'paymentsSYP', 'receiptsUSD', 'paymentsUSD']

const pack = ([rSYP, pSYP, rUSD, pUSD]) => ({
  SYP: { receipts: rSYP, payments: pSYP },
  USD: { receipts: rUSD, payments: pUSD },
})

/**
 * Sums over all non-archived cashbook rows.
 * Reads matching rows and sums values on the client.
 */
export async function allTimeCash() {
  const q = query(
    collection(db, COL.milk),
    where('archived', '==', false)
  )

  const snapshot = await getDocs(q)
  const totals = [0, 0, 0, 0]

  snapshot.forEach((doc) => {
    const row = doc.data()

    FIELDS.forEach((field, i) => {
      totals[i] += Number(row[field]) || 0
    })
  })

  return pack(totals)
}
