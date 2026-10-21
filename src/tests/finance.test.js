import { describe, it, expect } from 'vitest'
import { totalLiters, cashSummary, expensesByCategory, milkProduction, ledgerBalances, landCostReport, convert, repaymentExceedsLiability } from '../utils/finance.js'

describe('finance', () => {
  it('morning + evening', () => expect(totalLiters({ morningL: 95.5, eveningL: 59 })).toBe(154.5))
  it('keeps stored liters when no split', () => expect(totalLiters({ liters: 144 })).toBe(144))
  it('cash per currency, partner-funded excluded', () => {
    const c = cashSummary([{ receiptsSYP: 936000 }, { paymentsSYP: 45000 }, { partnerAmount: 6700000, partnerCurrency: 'SYP' }, { paymentsUSD: 10 }])
    expect(c.SYP).toEqual({ receipts: 936000, payments: 45000, net: 891000 })
    expect(c.USD.net).toBe(-10)
  })
  it('partner-funded counted once as expense, not cash', () => {
    const e = expensesByCategory([{ category: 'علف', paymentsSYP: 100 }, { category: 'علف', partnerAmount: 13, partnerCurrency: 'USD' }])
    expect(e['علف']).toEqual({ SYP: 100, USD: 13 })
  })
  it('milk production', () => expect(milkProduction([{ morningL: 93 }, { morningL: 1, eveningL: 58.5 }]).total).toBe(152.5))
  it('ledger running balance', () => {
    const l = ledgerBalances([{ partner: 'أبو وليد', date: '2026-01-01', additionSYP: 17000000 }, { partner: 'أبو وليد', date: '2026-02-01', repaymentSYP: 5000000 }])
    expect(l[1].balance).toBe(12000000)
    expect(repaymentExceedsLiability(12000000, 13000000)).toBe(true)
  })
  it('land cost never mixes currencies', () => {
    const r = landCostReport([{ category: 'ثمن شراء الأرض', partner: 'أبو وليد', amount: 25000, currency: 'USD' }, { category: 'ثمن شراء الأرض', partner: 'أبو غفير', amount: 3250, currency: 'USD' }], ['ثمن شراء الأرض'], ['أبو وليد', 'أبو غفير'])
    expect(r.total).toEqual({ USD: 28250, SYP: 0 })
  })
  it('conversion needs explicit rate/date', () => {
    expect(() => convert({ amount: 1, from: 'USD', to: 'SYP' })).toThrow()
    expect(convert({ amount: 2, from: 'USD', to: 'SYP', rate: 10000, rateDate: '2026-10-01' }).converted).toBe(20000)
  })
})
