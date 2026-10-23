import { doc, getDoc, collection, serverTimestamp, writeBatch, updateDoc } from 'firebase/firestore'
import { db, auth } from '../firebase/config'
import { audit, COL } from './db'
import { parseNumber, requireDate, requireCurrency, isValidDate, localToday } from '../utils/money'

const uid = () => auth.currentUser?.uid || null
const meta = () => ({ archived: false, createdBy: uid(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
export const ID_RE = /^[A-Za-z]\d{3,4}$/

/** Pure: the cash-payment document for a cattle purchase (so it can be unit-tested). */
export function purchaseCashDoc(animal, price, cur, date) {
  return { date, type: 'مدفوعات', category: 'شراء حيوان', description: `شراء ${animal.animalId} ${animal.name || ''}`.trim(), [`payments${cur}`]: price, [`net${cur}`]: -price,
    expAmount: price, expCurrency: cur, paymentStatus: 'مدفوع', payer: 'صندوق المزرعة', linkedAnimalId: animal.animalId, entryKind: 'cattlePurchase' }
}

/**
 * Adds an animal. When a purchase price is given and recordCash is true, the matching cash payment is written
 * in the SAME atomic batch with a deterministic id (cp_<animalId>), so it can never be duplicated.
 */
export async function addAnimal(a, { recordCash = false } = {}) {
  const id = String(a.animalId || '').trim().toUpperCase()
  if (!id) throw new Error('رقم الحيوان مطلوب')
  const price = parseNumber(a.purchasePrice, 'سعر الشراء', { min: 0, maxDecimals: 2 })
  const baselineMilkL = parseNumber(a.baselineMilkL, 'إنتاج الحليب الأساسي', { min: 0, maxDecimals: 3 })
  for (const [k, l] of [['purchaseDate', 'تاريخ الشراء'], ['birthDate', 'تاريخ الولادة']]) if (a[k] && !isValidDate(a[k])) throw new Error(`${l} غير صالح`)
  if (price !== null && price > 0) requireCurrency(a.currency)
  const motherId = a.motherId ? String(a.motherId).trim().toUpperCase() : null
  const ref = doc(db, COL.cattle, id)
  if ((await getDoc(ref)).exists()) throw new Error(`المعرّف ${id} موجود مسبقاً`)
  if (motherId && !(await getDoc(doc(db, COL.cattle, motherId))).exists()) throw new Error(`الأم ${motherId} غير موجودة`)
  const date = a.purchaseDate || a.birthDate || localToday()
  const data = { ...a, animalId: id, motherId, purchasePrice: price, baselineMilkL, purchaseDate: a.purchaseDate || null, birthDate: a.birthDate || null, date, ...meta() }
  const b = writeBatch(db)
  if (recordCash && price > 0) {
    const mref = doc(db, COL.milk, `cp_${id}`)
    b.set(mref, { ...purchaseCashDoc({ animalId: id, name: a.name }, price, a.currency, date), ...meta() })
    data.linkedMilkId = mref.id
  }
  b.set(ref, data); await b.commit()
  await audit('create', COL.cattle, id, null, data); return id
}
export async function updateAnimal(id, patch, before) {
  await updateDoc(doc(db, COL.cattle, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: uid() }); await audit('update', COL.cattle, id, before, patch)
}
/** Records an event; applies status side effects; never deletes the animal. Optional linked cash movement in the same batch. */
export async function recordEvent(animal, ev) {
  requireDate(ev.date)
  const amount = parseNumber(ev.amount, 'المبلغ', { min: 0, maxDecimals: 2 })
  if (ev.type === 'بيع' && animal.status === 'مباع') throw new Error('هذا الحيوان مسجَّل كمباع بالفعل')
  if (ev.type === 'نفوق' && animal.status === 'نافق') throw new Error('هذا الحيوان مسجَّل كنافق بالفعل')
  if (ev.cash) { if (!(amount > 0)) throw new Error('أدخل المبلغ لتسجيل حركة النقد'); requireCurrency(ev.currency) }
  else if (amount > 0 && ev.currency) requireCurrency(ev.currency)
  const batch = writeBatch(db); const eref = doc(collection(db, COL.cattleEvents))
  const base = { animalId: animal.animalId, type: ev.type, date: ev.date, amount, currency: ev.currency || null, notes: ev.notes || '', ...meta() }
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
  if (ev.cash && ['شراء', 'بيع', 'علاج'].includes(ev.type)) {
    const mref = doc(collection(db, COL.milk)); const isIn = ev.type === 'بيع'
    batch.set(mref, { date: ev.date, type: isIn ? 'مقبوضات أخرى' : 'مدفوعات', category: ev.type === 'علاج' ? 'دواء وعلاج' : 'شراء حيوان', description: `${ev.type} ${animal.animalId} ${animal.name || ''}`.trim(),
      [`${isIn ? 'receipts' : 'payments'}${ev.currency}`]: amount, [`net${ev.currency}`]: isIn ? amount : -amount, linkedEventId: eref.id, animalId: animal.animalId, entryKind: 'cattleCash', ...meta() })
    batch.update(eref, { linkedMilkId: mref.id })
  }
  await batch.commit(); await audit('create', COL.cattleEvents, eref.id, null, base); return eref.id
}
