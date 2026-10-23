import { prepareMilkDoc, numOrNull } from '../../utils/docs'
import { COL } from '../../services/db'
import { saveMilkDoc, archiveMilk } from '../../services/milkLinks'
import { parseNumber, requireDate, requireCurrency } from '../../utils/money'

const MILK_COLS = [
  { key: 'date', label: 'التاريخ' }, { key: 'type', label: 'نوع الحركة' }, { key: 'category', label: 'التصنيف' }, { key: 'description', label: 'البيان' },
  { key: 'morningL', label: 'صباحاً (ل)', num: true }, { key: 'eveningL', label: 'مساءً (ل)', num: true }, { key: 'liters', label: 'الإجمالي (ل)', num: true }, { key: 'pricePerL', label: 'سعر اللتر', num: true },
  { key: 'receiptsSYP', label: 'مقبوضات ل.س', num: true }, { key: 'paymentsSYP', label: 'مدفوعات ل.س', num: true }, { key: 'netSYP', label: 'صافي ل.س', num: true },
  { key: 'receiptsUSD', label: 'مقبوضات USD', num: true }, { key: 'paymentsUSD', label: 'مدفوعات USD', num: true }, { key: 'netUSD', label: 'صافي USD', num: true },
  { key: 'method', label: 'طريقة الدفع' }, { key: 'fundingSource', label: 'مصدر التمويل' }, { key: 'partnerAmount', label: 'مصروف شريك', num: true }, { key: 'partnerCurrency', label: 'عملة الشريك' }, { key: 'notes', label: 'ملاحظات' },
]
const MILK_FIELDS = [
  { name: 'date', label: 'التاريخ', type: 'date', required: true },
  { name: 'type', label: 'نوع الحركة', type: 'select', listKey: 'txTypes', required: true },
  { name: 'category', label: 'التصنيف', type: 'select', listKey: 'expenseCategories', required: true },
  { name: 'description', label: 'البيان', type: 'text' },
  { name: 'morningL', label: 'حليب صباحاً (لتر)', type: 'number' }, { name: 'eveningL', label: 'حليب مساءً (لتر)', type: 'number' },
  { name: 'liters', label: 'الكمية (لتر)', type: 'number', hint: 'تُحسب تلقائياً من الصباح+المساء إن وُجدا' }, { name: 'pricePerL', label: 'سعر اللتر (ل.س)', type: 'number' },
  { name: 'receiptsSYP', label: 'مقبوضات (ل.س)', type: 'number' }, { name: 'paymentsSYP', label: 'مدفوعات (ل.س)', type: 'number' },
  { name: 'receiptsUSD', label: 'مقبوضات (USD)', type: 'number' }, { name: 'paymentsUSD', label: 'مدفوعات (USD)', type: 'number' },
  { name: 'method', label: 'طريقة الدفع/القبض', type: 'select', listKey: 'paymentMethods' },
  { name: 'fundingSource', label: 'مصدر التمويل', type: 'select', listKey: 'fundingSources' },
  { name: 'partnerAmount', label: 'مصروف دفعه الشريك (المبلغ)', type: 'number', hint: 'لا يؤثر على رصيد الصندوق' },
  { name: 'partnerCurrency', label: 'عملة مصروف الشريك', type: 'select', listKey: 'currencies' },
  { name: 'notes', label: 'ملاحظات', type: 'textarea' },
]
export const cashbookCfg = { title: 'الصندوق (Milk_Box)', collection: COL.milk, columns: MILK_COLS, fields: MILK_FIELDS, prepare: prepareMilkDoc, save: saveMilkDoc, archive: archiveMilk, exportName: 'cashbook',
  searchKeys: ['description', 'notes', 'category'], filters: [{ key: 'type', label: 'النوع', listKey: 'txTypes' }, { key: 'category', label: 'التصنيف', listKey: 'expenseCategories' }, { key: 'fundingSource', label: 'التمويل', listKey: 'fundingSources' }, { key: 'partnerCurrency', label: 'عملة الشريك', listKey: 'currencies' }] }

export const productionCfg = { ...cashbookCfg, title: 'إنتاج الحليب والمبيعات', exportName: 'milk_production_sales', rowFilter: (r) => r.type === 'حليب أولي' || r.type === 'مبيعات حليب',
  columns: MILK_COLS.filter((c) => ['date', 'type', 'description', 'morningL', 'eveningL', 'liters', 'pricePerL', 'receiptsSYP', 'receiptsUSD', 'method', 'notes'].includes(c.key)),
  filters: [{ key: 'type', label: 'النوع', options: ['حليب أولي', 'مبيعات حليب'] }],
  defaults: { type: 'حليب أولي', category: 'حليب' } }

const EXP_STATUS = ['مدفوع', 'مستحق']
export const expensesCfg = {
  title: 'إدارة المصروفات', collection: COL.milk, exportName: 'expenses', searchKeys: ['description', 'category', 'notes'],
  rowFilter: (r) => r.type === 'مصروف حظيرة' || r.type === 'مدفوعات' || r.partnerAmount != null,
  columns: [{ key: 'date', label: 'التاريخ' }, { key: 'category', label: 'التصنيف' }, { key: 'description', label: 'البيان' }, { key: 'expAmount', label: 'المبلغ', num: true }, { key: 'expCurrency', label: 'العملة' },
    { key: 'paymentStatus', label: 'الحالة' }, { key: 'fundingSource', label: 'الممول' }, { key: 'method', label: 'طريقة الدفع' },
    { key: 'attachmentUrl', label: 'مستند', render: (r) => (r.attachmentUrl ? <a className="text-brand-600 underline" href={r.attachmentUrl} target="_blank" rel="noreferrer">عرض</a> : '') }],
  filters: [{ key: 'category', label: 'التصنيف', listKey: 'expenseCategories' }, { key: 'expCurrency', label: 'العملة', listKey: 'currencies' }, { key: 'paymentStatus', label: 'الحالة', options: EXP_STATUS }, { key: 'fundingSource', label: 'الممول', listKey: 'fundingSources' }],
  defaults: { paymentStatus: 'مدفوع', payer: 'صندوق المزرعة', currency: 'SYP' },
  fields: [
    { name: 'date', label: 'التاريخ', type: 'date', required: true }, { name: 'category', label: 'التصنيف', type: 'select', listKey: 'expenseCategories', required: true },
    { name: 'description', label: 'البيان', type: 'text' }, { name: 'amount', label: 'المبلغ', type: 'number', required: true }, { name: 'currency', label: 'العملة', type: 'select', listKey: 'currencies', required: true },
    { name: 'paymentStatus', label: 'حالة الدفع', type: 'select', options: EXP_STATUS, required: true },
    { name: 'payer', label: 'من دفع؟', type: 'select', options: ['صندوق المزرعة', 'شريك'], required: true, showIf: (v) => v.paymentStatus === 'مدفوع' },
    { name: 'fundingSource', label: 'الشريك', type: 'select', listKey: 'partners', showIf: (v) => v.payer === 'شريك' && v.paymentStatus === 'مدفوع', required: true },
    { name: 'method', label: 'طريقة الدفع', type: 'select', listKey: 'paymentMethods' },
    { name: 'attachment', label: 'مستند/إيصال', type: 'file' }, { name: 'notes', label: 'ملاحظات', type: 'textarea' }],
  /** Edit form needs the unified field names (amount/currency/payer) even for rows created by Daily Entry or imported from Excel. */
  toForm: (r) => {
    const cur = r.expCurrency || (r.paymentsUSD != null ? 'USD' : r.partnerCurrency || 'SYP')
    const amount = r.expAmount ?? r.payableAmount ?? r.partnerAmount ?? r[`payments${cur}`] ?? ''
    return { ...r, amount, currency: cur, paymentStatus: r.paymentStatus || 'مدفوع', payer: r.payer || (r.partnerAmount != null ? 'شريك' : 'صندوق المزرعة') }
  },
  save: saveMilkDoc, archive: archiveMilk,
  prepare: (v) => {
    requireDate(v.date); const cur = requireCurrency(v.currency)
    const amt = parseNumber(v.amount, 'المبلغ', { required: true, positive: true, maxDecimals: 2 })
    if (!EXP_STATUS.includes(v.paymentStatus)) throw new Error('اختر حالة الدفع')
    const paid = v.paymentStatus === 'مدفوع'; const byPartner = paid && v.payer === 'شريك'
    if (byPartner && !v.fundingSource) throw new Error('اختر الشريك')
    const base = { date: v.date, type: 'مصروف حظيرة', category: v.category, description: v.description || '', method: v.method || null, notes: v.notes || '', paymentStatus: v.paymentStatus,
      fundingSource: byPartner ? v.fundingSource : null, expAmount: amt, expCurrency: cur, payer: paid ? (v.payer || 'صندوق المزرعة') : null, attachmentUrl: v.attachmentUrl || null,
      receiptsSYP: null, receiptsUSD: null, paymentsSYP: null, paymentsUSD: null, netSYP: null, netUSD: null, partnerAmount: null, partnerCurrency: null, payableAmount: null }
    if (!paid) base.payableAmount = amt // incurred, not yet paid: no cash, no partner liability yet
    else if (byPartner) { base.partnerAmount = amt; base.partnerCurrency = cur } // not cash
    else { base[`payments${cur}`] = amt; base[`net${cur}`] = -amt }
    return base
  },
}
