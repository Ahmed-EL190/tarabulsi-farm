// Shared validation + money helpers. Pure (no Firebase). All messages are user-facing Arabic.
export const CURRENCIES = ['SYP', 'USD']

const decimalsOf = (s) => { const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1 }

/**
 * Strict number parser for form input.
 * - '' / null / undefined  -> null (or throws when required)
 * - rejects NaN, Infinity, exponent notation, thousands separators, text
 * - min: 0 forbids negatives, positive: forbids zero too, maxDecimals limits precision
 */
export function parseNumber(v, label, { required = false, min = null, positive = false, maxDecimals = null } = {}) {
  if (v === '' || v === null || v === undefined) { if (required) throw new Error(`${label} مطلوب`); return null }
  let s
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`${label}: رقم غير صالح`)
    s = String(v)
    if (/e/i.test(s)) throw new Error(`${label}: رقم غير صالح`)
  } else {
    s = String(v).trim()
    if (s === '') { if (required) throw new Error(`${label} مطلوب`); return null }
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`${label}: أدخل رقماً صحيحاً`)
  }
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`${label}: رقم غير صالح`)
  if (positive && n <= 0) throw new Error(`${label} يجب أن يكون أكبر من صفر`)
  if (min !== null && n < min) throw new Error(`${label} لا يمكن أن يكون سالباً`)
  if (maxDecimals !== null && decimalsOf(s) > maxDecimals) throw new Error(`${label}: الحد الأقصى ${maxDecimals} خانات عشرية`)
  return n
}

/** Half-away-from-zero rounding that survives binary float noise (1.005 -> 1.01, 0.1*3 -> 0.3). */
export function round(n, d = 2) {
  const m = 10 ** d
  return (Math.sign(n) * Math.round(Math.abs(n) * m + 1e-9)) / m
}
/** quantity × unit price, rounded to currency precision. */
export const mulMoney = (qty, price) => round(qty * price, 2)

/** Strict YYYY-MM-DD that is a real calendar date. */
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return y >= 2000 && y <= 2100 && t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
export function requireDate(s, label = 'التاريخ') {
  if (!isValidDate(s)) throw new Error(`${label} مطلوب وبصيغة صحيحة`)
  return s
}
export function requireCurrency(c) {
  if (!c) throw new Error('اختر العملة')
  if (!CURRENCIES.includes(c)) throw new Error('عملة غير مدعومة')
  return c
}
/** Local calendar date (not UTC) as YYYY-MM-DD. */
export const localToday = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
