// Maps a Daily Entry form to the stored Milk_Box-style document. Pure and unit-tested.
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const cashFields = (dir, amount, cur) => {
  const a = num(amount); const o = { receiptsSYP: null, paymentsSYP: null, receiptsUSD: null, paymentsUSD: null }
  if (a === null) return o
  o[`${dir}${cur}`] = a; return o
}
const withNet = (d) => { // same rule as Milk_Box: net is blank when no cash amount exists in that currency
  for (const c of ['SYP', 'USD']) { const r = d[`receipts${c}`], p = d[`payments${c}`]; d[`net${c}`] = r === null && p === null ? null : (r ?? 0) - (p ?? 0) }
  return d
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
  if (kind === 'wages' && v.workerName && !v.description) v = { ...v, description: `أجر ${v.workerName}` }
  const doc = { date: v.date, type: k.type, category: v.category || k.category, description: v.description || '', morningL: null, eveningL: null, liters: null, pricePerL: null,
    customer: v.customer || null, workerName: v.workerName || null, settlesCustomer: v.settlesCustomer || null, method: v.method || null, notes: v.notes || '', fundingSource: v.fundingSource || null, partnerAmount: null, partnerCurrency: null,
    receiptsSYP: null, paymentsSYP: null, receiptsUSD: null, paymentsUSD: null, entryKind: kind }
  if (kind === 'production') {
    doc.morningL = num(v.morningL); doc.eveningL = num(v.eveningL)
    if (doc.morningL === null && doc.eveningL === null) throw new Error('أدخل كمية الصباح أو المساء')
    if ((doc.morningL ?? 0) < 0 || (doc.eveningL ?? 0) < 0) throw new Error('الكمية لا يمكن أن تكون سالبة')
    doc.liters = (doc.morningL ?? 0) + (doc.eveningL ?? 0) // production is NOT revenue: no receipts
    return withNet(doc)
  }
  if (kind === 'sale') {
    doc.liters = num(v.liters); doc.pricePerL = num(v.pricePerL)
    if (doc.liters === null || !(doc.liters > 0)) throw new Error('كمية المبيع مطلوبة')
    if (doc.pricePerL === null || !(doc.pricePerL > 0)) throw new Error('سعر اللتر مطلوب')
    if (!['SYP', 'USD'].includes(v.currency)) throw new Error('اختر العملة')
    const discount = num(v.discount) ?? 0; if (discount < 0) throw new Error('الخصم لا يمكن أن يكون سالباً')
    const gross = doc.liters * doc.pricePerL - discount; if (gross < 0) throw new Error('الخصم أكبر من قيمة البيع')
    const collected = v.collected === '' || v.collected === undefined || v.collected === null ? gross : num(v.collected) // credit sale: collected < gross
    if (collected < 0) throw new Error('المحصَّل لا يمكن أن يكون سالباً')
    if (collected > gross + 1e-9) throw new Error('المحصَّل أكبر من صافي البيع — سجّل الزيادة كمقبوضات منفصلة')
    // nothing collected => no receipt row amount (blank, not zero)
    Object.assign(doc, cashFields('receipts', collected > 0 ? collected : null, v.currency))
    doc.saleNet = gross; doc.outstanding = Math.max(0, gross - collected); doc.saleCurrency = v.currency; doc.discount = discount || null
    return withNet(doc)
  }
  if (!['SYP', 'USD'].includes(v.currency)) throw new Error('اختر العملة')
  if (num(v.amount) === null || !(num(v.amount) > 0)) throw new Error('المبلغ مطلوب ويجب أن يكون أكبر من صفر')
  if (kind === 'partnerExpense') {
    if (!v.fundingSource) throw new Error('اختر الشريك')
    doc.partnerAmount = num(v.amount); doc.partnerCurrency = v.currency // no cash movement
    return withNet(doc)
  }
  Object.assign(doc, cashFields(kind === 'receipt' ? 'receipts' : 'payments', v.amount, v.currency))
  doc.paymentStatus = kind === 'receipt' ? null : 'مدفوع'
  return withNet(doc)
}
/** Stable fingerprint to block accidental double submits. */
export const entryFingerprint = (d) => [d.date, d.type, d.category, d.description, d.morningL, d.eveningL, d.liters, d.receiptsSYP, d.paymentsSYP, d.receiptsUSD, d.paymentsUSD, d.partnerAmount, d.partnerCurrency, d.customer, d.workerName, d.settlesCustomer].join('|')
