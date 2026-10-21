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
export function watch(col, cb, opts = {}) {
  const c = [where('archived', '==', false)]
  if (opts.from) c.push(where('date', '>=', opts.from))
  if (opts.to) c.push(where('date', '<=', opts.to))
  return onSnapshot(query(collection(db, col), ...c, orderBy('date', 'desc'), limit(opts.max || 1000)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => cb([], e))
}
export { writeBatch, db }
