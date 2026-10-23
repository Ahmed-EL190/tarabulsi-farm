// Maps a Daily Entry form to the stored Milk_Box-style document. Pure and unit-tested.
import { parseNumber, round, mulMoney, requireDate, requireCurrency } from './money.js'

export const ENTRY_KINDS = {
  production: { label: 'إنتاج الحليب اليومي', type: 'حليب أولي', category: 'حليب' },
  sale: { label: 'بيع الحليب', type: 'مبيعات حليب', category: 'حليب' },
  receipt: { label: 'مقبوضات نقدية', type: 'مقبوضات أخرى', category: 'أخرى' },
  payment: { label: 'مدفوعات نقدية', type: 'مدفوعات', category: 'أخرى' },
  feed: { label: 'مشتريات الأعلاف', type: 'مصروف حظيرة', category: 'علف' },
  medicine: { label: 'أدوية وعلاج', type: 'مصروف حظيرة', category: 'دواء وعلاج' },
  wages: { label: 'أجور وعمال', type: 'مصروف حظيرة', category: 'أجور' },
  utilities: { label: 'صيانة وكهرباء وماء', type: 'مصروف حظيرة', category: 'صيانة' },
  partnerExpense: { label: 'مصاريف دفعها شريك', type: 'مصروف حظيرة', category: 'أخرى' },
  other: { label: 'حركة أخرى', type: 'مصروف حظيرة', category: 'أخرى' },
}
/** Kinds that are expenses: they also carry the fields the Expenses page reads (expAmount/expCurrency/paymentStatus/payer). */
const EXPENSE_KINDS = ['payment', 'feed', 'medicine', 'wages', 'utilities', 'partnerExpense', 'other']

const netOf = (r, p) => (r === null && p === null ? null : round((r ?? 0) - (p ?? 0), 2))

export function buildMilkDoc(kind, v) {
  const k = ENTRY_KINDS[kind]; if (!k) throw new Error('نوع إدخال غير معروف')
  requireDate(v.date)
  const doc = { date: v.date, type: k.type, category: v.category || k.category, description: (v.description || '').trim(), morningL: null, eveningL: null, liters: null, pricePerL: null,
    method: v.method || null, notes: v.notes || '', fundingSource: v.fundingSource || null, partnerAmount: null, partnerCurrency: null,
    receiptsSYP: null, paymentsSYP: null, receiptsUSD: null, paymentsUSD: null, netSYP: null, netUSD: null, entryKind: kind }
  const setCash = (dir, amount, cur) => { doc[`${dir}${cur}`] = amount; doc[`net${cur}`] = netOf(dir === 'receipts' ? amount : null, dir === 'payments' ? amount : null) }

  if (kind === 'production') {
    doc.morningL = parseNumber(v.morningL, 'كمية الصباح', { min: 0, maxDecimals: 3 })
    doc.eveningL = parseNumber(v.eveningL, 'كمية المساء', { min: 0, maxDecimals: 3 })
    if (doc.morningL === null && doc.eveningL === null) throw new Error('أدخل كمية الصباح أو المساء')
    doc.liters = round((doc.morningL ?? 0) + (doc.eveningL ?? 0), 3) // production is NOT revenue: no receipts
    return doc
  }
  if (kind === 'sale') {
    const cur = requireCurrency(v.currency || 'SYP')
    const liters = parseNumber(v.liters, 'الكمية المباعة', { required: true, positive: true, maxDecimals: 3 })
    const price = parseNumber(v.pricePerL, 'سعر اللتر', { required: true, positive: true, maxDecimals: 3 })
    const discount = parseNumber(v.discount, 'الخصم', { min: 0, maxDecimals: 2 }) ?? 0
    const total = mulMoney(liters, price)
    if (discount > total) throw new Error('الخصم أكبر من قيمة البيع')
    const net = round(total - discount, 2)
    const collected = parseNumber(v.collected, 'المبلغ المحصَّل', { min: 0, maxDecimals: 2 }) ?? net // empty = full collection
    if (collected > net) throw new Error('المبلغ المحصَّل أكبر من صافي البيع')
    doc.liters = liters; doc.pricePerL = price; doc.discount = discount
    setCash('receipts', collected, cur)
    doc.saleNet = net; doc.outstanding = round(net - collected, 2); doc.saleCurrency = cur // credit sale: outstanding > 0
    return doc
  }
  const cur = requireCurrency(v.currency)
  const amount = parseNumber(v.amount, 'المبلغ', { required: true, positive: true, maxDecimals: 2 })
  if (kind === 'partnerExpense') {
    if (!v.fundingSource) throw new Error('اختر الشريك')
    doc.partnerAmount = amount; doc.partnerCurrency = cur // no cash movement
  } else setCash(kind === 'receipt' ? 'receipts' : 'payments', amount, cur)
  if (EXPENSE_KINDS.includes(kind)) Object.assign(doc, { expAmount: amount, expCurrency: cur, paymentStatus: 'مدفوع', payer: kind === 'partnerExpense' ? 'شريك' : 'صندوق المزرعة', payableAmount: null })
  return doc
}

const norm = (x) => (x === undefined || x === null || x === '' ? null : typeof x === 'string' ? x.trim() : x)
/**
 * Duplicate-detection key. Covers every field that makes two transactions different
 * (date, type, quantity, unit price, discount, amounts per currency, party, method).
 * Computed from document fields, so it also works for imported/old documents.
 * JSON-encoded (no separator collisions).
 */
export const entryFingerprint = (d) => JSON.stringify([d.date, d.type, d.category, d.description, d.morningL, d.eveningL, d.liters, d.pricePerL, d.discount,
  d.receiptsSYP, d.paymentsSYP, d.receiptsUSD, d.paymentsUSD, d.partnerAmount, d.partnerCurrency, d.fundingSource, d.method].map(norm))
