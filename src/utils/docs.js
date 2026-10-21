export const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const hasAny = (...v) => v.some((x) => x !== null && x !== undefined && x !== '')
/** Milk_Box!G and K/S logic: total = morning+evening when present; net blank when no cash amounts (COUNTA rule). */
export function prepareMilkDoc(v) {
  const d = { ...v }
  for (const k of ['morningL', 'eveningL', 'liters', 'pricePerL', 'receiptsSYP', 'paymentsSYP', 'receiptsUSD', 'paymentsUSD', 'partnerAmount']) d[k] = numOrNull(d[k])
  for (const k of ['morningL', 'eveningL', 'liters', 'receiptsSYP', 'paymentsSYP', 'receiptsUSD', 'paymentsUSD', 'partnerAmount']) if (d[k] !== null && d[k] < 0) throw new Error('القيم لا يمكن أن تكون سالبة')
  if (d.morningL !== null || d.eveningL !== null) d.liters = (d.morningL ?? 0) + (d.eveningL ?? 0)
  if (d.partnerAmount !== null && !['SYP', 'USD'].includes(d.partnerCurrency)) throw new Error('عملة مصروف الشريك مطلوبة')
  d.netSYP = hasAny(d.receiptsSYP, d.paymentsSYP) ? (d.receiptsSYP ?? 0) - (d.paymentsSYP ?? 0) : null
  d.netUSD = hasAny(d.receiptsUSD, d.paymentsUSD) ? (d.receiptsUSD ?? 0) - (d.paymentsUSD ?? 0) : null
  if (!d.date) throw new Error('التاريخ مطلوب')
  return d
}
