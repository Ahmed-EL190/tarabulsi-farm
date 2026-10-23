import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, auth } from '../firebase/config'
import { audit } from './db'
import { COL } from './collections'
import { planPartnerLink } from '../utils/partnerLink'

const uid = () => auth.currentUser?.uid || null
/** An id that stays the same across retries of one submission (so a retried save overwrites instead of duplicating). */
export const newSubmissionId = () => doc(collection(db, COL.milk)).id

async function activeLinked(milkId) {
  const s = await getDocs(query(collection(db, COL.partnerExpenses), where('milkRef', '==', milkId)))
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => !d.archived)
}
function applyOps(b, ops) {
  for (const o of ops) {
    const ref = doc(db, COL.partnerExpenses, o.id)
    if (o.op === 'archive') b.update(ref, { archived: true, updatedAt: serverTimestamp(), updatedBy: uid() })
    else if (o.op === 'update') b.update(ref, { ...o.data, archived: false, updatedAt: serverTimestamp(), updatedBy: uid() })
    else b.set(ref, { ...o.data, archived: false, createdBy: uid(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }
}

/** Create (id=null, optional stable newId) or update a milk/cash doc and keep its partnerExpenses link consistent in ONE atomic batch. */
export async function saveMilkDoc({ id = null, newId = null, data, before = null }) {
  const { id: _i, createdAt: _c, updatedAt: _u, createdBy: _b, archived: _a, ...clean } = data
  const milkId = id || newId || doc(collection(db, COL.milk)).id
  const linked = id || newId ? await activeLinked(milkId) : []
  const b = writeBatch(db); const mref = doc(db, COL.milk, milkId)
  if (id) b.update(mref, { ...clean, updatedAt: serverTimestamp(), updatedBy: uid() })
  else b.set(mref, { ...clean, archived: false, createdBy: uid(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  applyOps(b, planPartnerLink({ milkId, doc: clean, linked }))
  await b.commit(); await audit(id ? 'update' : 'create', COL.milk, milkId, before, clean)
  return milkId
}
/** Archive a milk/cash doc together with the partnerExpenses rows linked to it (no stale linked records). */
export async function archiveMilk(id, before = null) {
  const linked = await activeLinked(id); const b = writeBatch(db)
  b.update(doc(db, COL.milk, id), { archived: true, updatedAt: serverTimestamp(), updatedBy: uid() })
  applyOps(b, planPartnerLink({ milkId: id, doc: before, linked, archiving: true }))
  await b.commit(); await audit('update', COL.milk, id, before, { archived: true })
}
