import { describe, it, expect } from 'vitest'
import { buildMilkDoc, entryFingerprint } from '../utils/entryMapping.js'
const D = '2026-10-20'
describe('daily entry mapping', () => {
  it('production has liters but no revenue', () => {
    const d = buildMilkDoc('production', { date: D, morningL: '95.5', eveningL: '59' })
    expect(d.liters).toBe(154.5); expect(d.receiptsSYP).toBeNull()
  })
  it('sale creates receipt and tracks outstanding', () => {
    const d = buildMilkDoc('sale', { date: D, liters: '100', pricePerL: '6500', currency: 'SYP', collected: '500000' })
    expect(d.receiptsSYP).toBe(500000); expect(d.outstanding).toBe(150000); expect(d.netSYP).toBe(500000)
  })
  it('partner expense moves no cash', () => {
    const d = buildMilkDoc('partnerExpense', { date: D, amount: '13', currency: 'USD', fundingSource: 'أبو وليد' })
    expect(d.paymentsUSD).toBeNull(); expect(d.partnerAmount).toBe(13); expect(d.payer).toBe('شريك')
  })
  it('payment in USD does not touch SYP and carries Expenses-page fields', () => {
    const d = buildMilkDoc('feed', { date: D, amount: '10', currency: 'USD' })
    expect(d.paymentsUSD).toBe(10); expect(d.paymentsSYP).toBeNull(); expect(d.netUSD).toBe(-10)
    expect(d).toMatchObject({ expAmount: 10, expCurrency: 'USD', paymentStatus: 'مدفوع', payer: 'صندوق المزرعة' })
  })
  it('receipt is not an expense', () => { expect(buildMilkDoc('receipt', { date: D, amount: '5', currency: 'SYP' }).expAmount).toBeUndefined() })
})
