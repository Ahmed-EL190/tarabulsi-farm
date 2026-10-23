// Pure payroll logic. One payroll sheet per worker per month; all amounts in the worker's own currency (never mixed).
const n = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v))
export const PAY_TYPES = ['شهري', 'يومي']

/** base = monthly rate, or daily rate × days worked. */
export const baseSalary = (payType, rate, daysWorked) => (payType === 'يومي' ? n(rate) * n(daysWorked) : n(rate))

/**
 * Validates and calculates a payroll sheet.
 * advBalance = what the worker still owes the farm in this currency (from the advances ledger).
 * Returns { error } or { calc: { base, gross, net } }.
 */
export function calcPayroll(x, advBalance = 0) {
  const base = baseSalary(x.payType, x.rate, x.daysWorked)
  const bonus = n(x.bonus), other = n(x.otherDeduction), adv = n(x.advanceDeduction)
  if (!['SYP', 'USD'].includes(x.currency)) return { error: 'العملة مطلوبة' }
  if (!PAY_TYPES.includes(x.payType)) return { error: 'نوع الأجر غير صالح' }
  if (!(n(x.rate) > 0)) return { error: 'قيمة الأجر مطلوبة' }
  if (x.payType === 'يومي' && !(n(x.daysWorked) > 0)) return { error: 'أدخل عدد أيام العمل' }
  if (bonus < 0 || other < 0 || adv < 0) return { error: 'القيم لا يمكن أن تكون سالبة' }
  if (other > 0 && !String(x.otherDeductionReason || '').trim()) return { error: 'اكتب سبب الخصم' }
  if (adv > n(advBalance) + 1e-9) return { error: `خصم السلفة يتجاوز المستحق على العامل (${n(advBalance)})` }
  const gross = base + bonus
  if (other + adv > gross + 1e-9) return { error: 'الخصومات أكبر من إجمالي المستحق' }
  return { calc: { base, gross, net: gross - other - adv } }
}
export const statusFor = (net, paid) => (n(paid) >= n(net) - 1e-9 ? 'مدفوع' : n(paid) > 0 ? 'مدفوع جزئياً' : 'مستحق')
export const remaining = (p) => Math.max(0, n(p.net) - n(p.paid))
export function validatePayment(p, amount) {
  const a = n(amount)
  if (!(a > 0)) return 'المبلغ غير صالح'
  if (a > remaining(p) + 1e-9) return `المبلغ يتجاوز المتبقي من المرتب (${remaining(p)})`
  return null
}
/** Totals per currency for a set of payroll sheets (archived ignored). */
export function payrollTotals(rows) {
  const t = {}
  for (const p of rows) {
    if (p.archived) continue
    const c = (t[p.currency] ??= { base: 0, bonus: 0, otherDeduction: 0, advanceDeduction: 0, net: 0, paid: 0, remaining: 0 })
    c.base += n(p.base); c.bonus += n(p.bonus); c.otherDeduction += n(p.otherDeduction); c.advanceDeduction += n(p.advanceDeduction); c.net += n(p.net); c.paid += n(p.paid); c.remaining += remaining(p)
  }
  return t
}
