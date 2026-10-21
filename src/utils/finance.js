// Pure financial logic. Never mixes currencies. Mirrors the Excel formulas (see docs/FORMULAS.md).
export const CURRENCIES = ['SYP', 'USD']
const n = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const has = (v) => v !== null && v !== undefined && v !== ''

/** Excel Milk_Box!G: total liters = morning + evening when either present; else stored value. */
export function totalLiters(row) {
  if (has(row.morningL) || has(row.eveningL)) return n(row.morningL) + n(row.eveningL)
  return n(row.liters)
}

/** Cash movement per currency. Partner-funded expenses are NOT cash (Milk_Box!Q/R). */
export function cashSummary(rows) {
  const out = { SYP: { receipts: 0, payments: 0, net: 0 }, USD: { receipts: 0, payments: 0, net: 0 } }
  for (const r of rows) {
    out.SYP.receipts += n(r.receiptsSYP); out.SYP.payments += n(r.paymentsSYP)
    out.USD.receipts += n(r.receiptsUSD); out.USD.payments += n(r.paymentsUSD)
  }
  for (const c of CURRENCIES) out[c].net = out[c].receipts - out[c].payments
  return out
}

/** Expenses incurred by category and currency = cash payments + partner-funded (not double counted). */
export function expensesByCategory(rows) {
  const out = {}
  const add = (cat, cur, v) => { if (!v) return; out[cat] ??= { SYP: 0, USD: 0 }; out[cat][cur] += v }
  for (const r of rows) {
    const cat = r.category || 'غير مصنف'
    add(cat, 'SYP', n(r.paymentsSYP)); add(cat, 'USD', n(r.paymentsUSD))
    if (has(r.partnerAmount) && CURRENCIES.includes(r.partnerCurrency)) add(cat, r.partnerCurrency, n(r.partnerAmount))
  }
  return out
}

export function milkProduction(rows) {
  let morning = 0, evening = 0
  for (const r of rows) { morning += n(r.morningL); evening += n(r.eveningL) }
  return { morning, evening, total: morning + evening }
}

/** Partner ledger: balance = opening + additions - actual repayments (SYP only). */
export function ledgerBalances(entries) {
  const byPartner = {}
  const sorted = [...entries].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  return sorted.map((e) => {
    const p = (byPartner[e.partner] ??= 0)
    byPartner[e.partner] = p + n(e.additionSYP) - n(e.repaymentSYP)
    return { ...e, balance: byPartner[e.partner] }
  })
}
export function repaymentExceedsLiability(currentBalance, repayment) { return n(repayment) > n(currentBalance) }

/** Land_Cost: SUMIFS(amount; partner; category; currency). */
export function landCostReport(txns, categories, partners) {
  const rows = categories.map((cat) => {
    const row = { category: cat, byPartner: {}, total: { USD: 0, SYP: 0 } }
    for (const p of partners) {
      row.byPartner[p] = { USD: 0, SYP: 0 }
      for (const t of txns) if (t.category === cat && t.partner === p && CURRENCIES.includes(t.currency)) {
        row.byPartner[p][t.currency] += n(t.amount); row.total[t.currency] += n(t.amount)
      }
    }
    return row
  })
  const total = { USD: 0, SYP: 0 }
  rows.forEach((r) => CURRENCIES.forEach((c) => (total[c] += r.total[c])))
  return { rows, total }
}

/** Optional explicit conversion: requires rate + date, never implicit. */
export function convert({ amount, from, to, rate, rateDate }) {
  if (!rate || rate <= 0 || !rateDate) throw new Error('سعر الصرف وتاريخه مطلوبان')
  if (from === to) return { amount, from, to, rate: 1, rateDate, converted: amount }
  const converted = from === 'USD' ? amount * rate : amount / rate // rate = SYP per 1 USD
  return { amount, from, to, rate, rateDate, converted }
}

/** Duplicate detection key used by the importer (idempotent re-imports). */
export function rowFingerprint(sheet, row) {
  return `${sheet}|${JSON.stringify(row, Object.keys(row).sort())}`
}
