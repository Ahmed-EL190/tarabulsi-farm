import { doc, getDoc, setDoc, collection, serverTimestamp, writeBatch, updateDoc } from 'firebase/firestore'
import { db, auth } from '../firebase/config'
import { audit, COL } from './db'

const meta = () => ({ archived: false, createdBy: auth.currentUser?.uid || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const today = () => new Date().toISOString().slice(0, 10)
export const ID_RE = /^[A-Za-z]\d{3,4}$/

export async function addAnimal(a) {
  const id = String(a.animalId || '').trim().toUpperCase()
  if (!id) throw new Error('رقم الحيوان مطلوب')
  const ref = doc(db, COL.cattle, id)
  if ((await getDoc(ref)).exists()) throw new Error(`المعرّف ${id} موجود مسبقاً`)
  if (a.motherId) { const m = await getDoc(doc(db, COL.cattle, a.motherId)); if (!m.exists()) throw new Error(`الأم ${a.motherId} غير موجودة`) }
  const data = { ...a, animalId: id, date: a.purchaseDate || a.birthDate || today(), ...meta() }
  await setDoc(ref, data); await audit('create', COL.cattle, id, null, data); return id
}
export async function updateAnimal(id, patch, before) {
  await updateDoc(doc(db, COL.cattle, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || null }); await audit('update', COL.cattle, id, before, patch)
}
/** Records an event; applies status side effects; never deletes the animal. Optional linked cash movement in the same batch. */
export async function recordEvent(animal, ev) {
  const batch = writeBatch(db); const eref = doc(collection(db, COL.cattleEvents))
  const base = { animalId: animal.animalId, type: ev.type, date: ev.date, amount: ev.amount ?? null, currency: ev.currency ?? null, notes: ev.notes || '', ...meta() }
  batch.set(eref, base)
  const aref = doc(db, COL.cattle, animal.animalId)
  const status = { 'بيع': 'مباع', 'نفوق': 'نافق', 'علاج': animal.status === 'نشط' ? 'علاج' : animal.status, 'تغيير حالة': ev.newStatus || animal.status }[ev.type]
  if (status && status !== animal.status) batch.update(aref, { status, updatedAt: serverTimestamp() })
  if (ev.type === 'ولادة') {
    const calfId = String(ev.calfId || '').trim().toUpperCase(); if (!calfId) throw new Error('رقم العجل/العجلة مطلوب')
    const cref = doc(db, COL.cattle, calfId); if ((await getDoc(cref)).exists()) throw new Error(`المعرّف ${calfId} موجود مسبقاً`)
    batch.set(cref, { animalId: calfId, name: ev.calfName || '', category: ev.calfCategory || 'عجل', status: 'نشط', motherId: animal.animalId, birthDate: ev.date, date: ev.date, currency: null, purchasePrice: null, ...meta() })
    batch.update(aref, { hasCalf: 'نعم', updatedAt: serverTimestamp() })
  }
  if (ev.cash && ev.amount > 0 && ['شراء', 'بيع', 'علاج'].includes(ev.type) && ['SYP', 'USD'].includes(ev.currency)) {
    const mref = doc(collection(db, COL.milk)); const isIn = ev.type === 'بيع'
    batch.set(mref, { date: ev.date, type: isIn ? 'مقبوضات أخرى' : 'مدفوعات', category: ev.type === 'علاج' ? 'دواء وعلاج' : 'شراء حيوان', description: `${ev.type} ${animal.animalId} ${animal.name || ''}`.trim(),
      [`${isIn ? 'receipts' : 'payments'}${ev.currency}`]: ev.amount, [`net${ev.currency}`]: isIn ? ev.amount : -ev.amount, linkedEventId: eref.id, animalId: animal.animalId, entryKind: 'cattleCash', ...meta() })
    batch.update(eref, { linkedMilkId: mref.id })
  }
  await batch.commit(); await audit('create', COL.cattleEvents, eref.id, null, base); return eref.id
}
