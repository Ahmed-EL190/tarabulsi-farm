import { parseNumber, round, requireDate } from './money.js'
export const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const hasAny = (...v) => v.some((x) => x !== null && x !== undefined && x !== '')
const FIELDS = { morningL: ['حليب الصباح', 3], eveningL: ['حليب المساء', 3], liters: ['الكمية', 3], pricePerL: ['سعر اللتر', 3], receiptsSYP: ['مقبوضات ل.س', 2], paymentsSYP: ['مدفوعات ل.س', 2],
  receiptsUSD: ['مقبوضات USD', 2], paymentsUSD: ['مدفوعات USD', 2], partnerAmount: ['مصروف الشريك', 2] }
/** Milk_Box!G and K/S logic: total = morning+evening when present; net blank when no cash amounts (COUNTA rule). Rejects NaN/Infinity/negatives/over-precise values. */
export function prepareMilkDoc(v) {
  const d = { ...v }
  requireDate(d.date)
  for (const [k, [label, dec]] of Object.entries(FIELDS)) d[k] = parseNumber(d[k], label, { min: 0, maxDecimals: dec })
  if (d.morningL !== null || d.eveningL !== null) d.liters = round((d.morningL ?? 0) + (d.eveningL ?? 0), 3)
  if (d.partnerAmount !== null) {
    if (!['SYP', 'USD'].includes(d.partnerCurrency)) throw new Error('عملة مصروف الشريك مطلوبة')
    if (!d.fundingSource) throw new Error('اختر الشريك الذي دفع المصروف')
  }
  d.netSYP = hasAny(d.receiptsSYP, d.paymentsSYP) ? round((d.receiptsSYP ?? 0) - (d.paymentsSYP ?? 0), 2) : null
  d.netUSD = hasAny(d.receiptsUSD, d.paymentsUSD) ? round((d.receiptsUSD ?? 0) - (d.paymentsUSD ?? 0), 2) : null
  return d
}
