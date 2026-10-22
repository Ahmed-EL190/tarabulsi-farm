// Maps a Daily Entry form to the stored Milk_Box-style document. Pure and unit-tested.
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const cashFields = (dir, amount, cur) => {
  const a = num(amount); const o = { receiptsSYP: null, paymentsSYP: null, receiptsUSD: null, paymentsUSD: null }
  if (a === null) return o
  o[`${dir}${cur}`] = a; return o
}
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
export function buildMilkDoc(kind, v) {
  const k = ENTRY_KINDS[kind]; if (!k) throw new Error('نوع إدخال غير معروف')
  const doc = { date: v.date, type: k.type, category: v.category || k.category, description: v.description || '', morningL: null, eveningL: null, liters: null, pricePerL: null,
    customer: v.customer || null, settlesCustomer: v.settlesCustomer || null, method: v.method || null, notes: v.notes || '', fundingSource: v.fundingSource || null, partnerAmount: null, partnerCurrency: null,
    receiptsSYP: null, paymentsSYP: null, receiptsUSD: null, paymentsUSD: null, entryKind: kind }
  if (kind === 'production') {
    doc.morningL = num(v.morningL); doc.eveningL = num(v.eveningL)
    if (doc.morningL === null && doc.eveningL === null) throw new Error('أدخل كمية الصباح أو المساء')
    if ((doc.morningL ?? 0) < 0 || (doc.eveningL ?? 0) < 0) throw new Error('الكمية لا يمكن أن تكون سالبة')
    doc.liters = (doc.morningL ?? 0) + (doc.eveningL ?? 0) // production is NOT revenue: no receipts
    return doc
  }
  if (kind === 'sale') {
    doc.liters = num(v.liters); doc.pricePerL = num(v.pricePerL)
    if (doc.liters === null || doc.liters < 0) throw new Error('كمية المبيع مطلوبة')
    const gross = doc.liters * (doc.pricePerL ?? 0) - (num(v.discount) ?? 0)
    const collected = v.collected === '' || v.collected === undefined ? gross : num(v.collected) // credit sale: collected < gross
    Object.assign(doc, cashFields('receipts', collected, v.currency || 'SYP'))
    doc.saleNet = gross; doc.outstanding = Math.max(0, gross - (collected ?? 0)); doc.saleCurrency = v.currency || 'SYP'
    return doc
  }
  if (!v.currency) throw new Error('اختر العملة')
  if (num(v.amount) === null || num(v.amount) < 0) throw new Error('المبلغ مطلوب')
  if (kind === 'partnerExpense') {
    if (!v.fundingSource) throw new Error('اختر الشريك')
    doc.partnerAmount = num(v.amount); doc.partnerCurrency = v.currency // no cash movement
    return doc
  }
  Object.assign(doc, cashFields(kind === 'receipt' ? 'receipts' : 'payments', v.amount, v.currency))
  return doc
}
/** Stable fingerprint to block accidental double submits. */
export const entryFingerprint = (d) => [d.date, d.type, d.category, d.description, d.morningL, d.eveningL, d.liters, d.receiptsSYP, d.paymentsSYP, d.receiptsUSD, d.paymentsUSD, d.partnerAmount, d.partnerCurrency].join('|')
