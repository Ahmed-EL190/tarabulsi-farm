// Pure logic for advances (سلف) given to workers or partners. Never mixes currencies.
export const ADV_TYPES = ['سلفة', 'سداد', 'خصم من الأجر', 'تعديل زيادة', 'تعديل خصم']
const PLUS = new Set(['سلفة', 'تعديل زيادة'])
export const signed = (e) => (PLUS.has(e.type) ? 1 : -1) * (Number(e.amount) || 0)

/** One row per (personType, person, currency): advanced, repaid, balance (= still owed to the farm). */
export function advanceBalances(entries) {
  const m = {}
  for (const e of entries) {
    if (e.archived) continue
    const k = `${e.personType}|${e.person}|${e.currency}`
    const r = (m[k] ??= { personType: e.personType, person: e.person, currency: e.currency, advanced: 0, repaid: 0, balance: 0 })
    const s = signed(e); if (s >= 0) r.advanced += s; else r.repaid += -s; r.balance += s
  }
  return Object.values(m).sort((a, b) => a.personType.localeCompare(b.personType) || a.person.localeCompare(b.person))
}
export const balanceOf = (entries, personType, person, currency) =>
  advanceBalances(entries).find((r) => r.personType === personType && r.person === person && r.currency === currency)?.balance ?? 0

/** Repayment / wage deduction can never exceed what is owed; use an explained adjustment instead. */
export function validateAdvance(entries, x) {
  const amt = Number(x.amount)
  if (!x.person || !String(x.person).trim()) return 'اسم الشخص مطلوب'
  if (!(amt > 0)) return 'المبلغ غير صالح'
  if (!['SYP', 'USD'].includes(x.currency)) return 'اختر العملة'
  if (!x.date) return 'التاريخ مطلوب'
  if (!ADV_TYPES.includes(x.type)) return 'نوع الحركة غير صالح'
  if (x.type === 'خصم من الأجر' && x.personType !== 'عامل') return 'الخصم من الأجر للعمال فقط'
  if ((x.type === 'تعديل زيادة' || x.type === 'تعديل خصم') && !String(x.notes || '').trim()) return 'التعديل يتطلب تفسيراً في الملاحظات'
  if ((x.type === 'سداد' || x.type === 'خصم من الأجر') && amt > balanceOf(entries, x.personType, String(x.person).trim(), x.currency) + 1e-9) return 'المبلغ يتجاوز السلفة المستحقة — استخدم «تعديل خصم» مع تفسير'
  return null
}
/** Cash movement created with the entry: advance out of the cashbox, repayment into it. Wage deductions & adjustments move no cash. */
export function cashDirection(type) { return type === 'سلفة' ? 'out' : type === 'سداد' ? 'in' : null }
