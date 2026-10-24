import { collection, doc, addDoc, updateDoc, getDocs, query, where, orderBy, limit, serverTimestamp, writeBatch, onSnapshot } from 'firebase/firestore'
import { db, auth } from '../firebase/config'

import { COL as C } from './collections'
export const COL = C

const actor = () => auth.currentUser?.uid || null
export async function audit(op, col, id, before, after) {
  await addDoc(collection(db, COL.audit), { op, col, id, before: before ?? null, after: after ?? null, by: actor(), at: serverTimestamp() })
}
export async function create(col, data) {
  const ref = await addDoc(collection(db, col), { ...data, archived: false, createdBy: actor(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  await audit('create', col, ref.id, null, data)
  return ref.id
}
export async function update(col, id, data, before) {
  await updateDoc(doc(db, col, id), { ...data, updatedBy: actor(), updatedAt: serverTimestamp() })
  await audit('update', col, id, before, data)
}
/** Archive instead of deleting financial history. */
export const archive = (col, id, before) => update(col, id, { archived: true }, before)

export async function listRange(col, { from, to, max = 1000 } = {}) {
  const c = [where('archived', '==', false)]
  if (from) c.push(where('date', '>=', from))
  if (to) c.push(where('date', '<=', to))
  const snap = await getDocs(query(collection(db, col), ...c, orderBy('date', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
export const DEFAULT_MAX = 3000
export function watch(col, cb, opts = {}) {
  const c = [where('archived', '==', false)]
  if (opts.from) c.push(where('date', '>=', opts.from))
  if (opts.to) c.push(where('date', '<=', opts.to))
  return onSnapshot(query(collection(db, col), ...c, orderBy('date', 'desc'), limit(opts.max || DEFAULT_MAX)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => cb([], e))
}
export { writeBatch, db }

/** Archive a cashbook row together with the partner-expense rows linked to it, so the two never disagree. */
export async function archiveMilkRow(row) {
  const snap = await getDocs(query(collection(db, COL.partnerExpenses), where('milkRef', '==', row.id)))
  const b = writeBatch(db); const t = { archived: true, updatedAt: serverTimestamp(), updatedBy: actor() }
  b.update(doc(db, COL.milk, row.id), t); snap.forEach((d) => b.update(d.ref, t))
  await b.commit(); await audit('update', COL.milk, row.id, row, { archived: true })
}
/** Keep partnerExpenses consistent with a cashbook row: create / update / archive the linked record as needed. */
export async function syncPartnerExpenses(milkId, d) {
  const snap = await getDocs(query(collection(db, COL.partnerExpenses), where('milkRef', '==', milkId), where('archived', '==', false)))
  const has = d.partnerAmount != null && ['SYP', 'USD'].includes(d.partnerCurrency)
  if (!has) { if (snap.empty) return; const b = writeBatch(db); snap.forEach((x) => b.update(x.ref, { archived: true, updatedAt: serverTimestamp() })); return b.commit() }
  const fields = { date: d.date ?? null, partner: d.fundingSource || null, type: d.description || d.category || '', amount: d.partnerAmount, currency: d.partnerCurrency }
  if (snap.empty) { await create(COL.partnerExpenses, { ...fields, reimbursement: 'غير مسدد', milkRef: milkId, notes: d.notes || '' }); return }
  const { type: _t, ...upd } = fields; const b = writeBatch(db); snap.forEach((x) => b.update(x.ref, { ...upd, updatedAt: serverTimestamp() })); await b.commit()
}
