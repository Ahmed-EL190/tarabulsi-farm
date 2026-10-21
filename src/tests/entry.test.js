import { describe, it, expect } from 'vitest'
import { buildMilkDoc, entryFingerprint } from '../utils/entryMapping.js'
describe('daily entry mapping', () => {
  it('production has liters but no revenue', () => {
    const d = buildMilkDoc('production', { date: '2026-10-20', morningL: '95.5', eveningL: '59' })
    expect(d.liters).toBe(154.5); expect(d.receiptsSYP).toBeNull()
  })
  it('sale creates receipt and tracks outstanding', () => {
    const d = buildMilkDoc('sale', { date: '2026-10-20', liters: '100', pricePerL: '6500', currency: 'SYP', collected: '500000' })
    expect(d.receiptsSYP).toBe(500000); expect(d.outstanding).toBe(150000)
  })
  it('partner expense moves no cash', () => {
    const d = buildMilkDoc('partnerExpense', { date: '2026-10-20', amount: '13', currency: 'USD', fundingSource: 'أبو وليد' })
    expect(d.paymentsUSD).toBeNull(); expect(d.partnerAmount).toBe(13)
  })
  it('payment in USD does not touch SYP', () => {
    const d = buildMilkDoc('feed', { date: '2026-10-20', amount: '10', currency: 'USD' })
    expect(d.paymentsUSD).toBe(10); expect(d.paymentsSYP).toBeNull()
  })
  it('rejects missing currency/negative', () => {
    expect(() => buildMilkDoc('feed', { date: 'x', amount: '5' })).toThrow()
    expect(() => buildMilkDoc('production', { date: 'x', morningL: '-1' })).toThrow()
  })
  it('fingerprint identical for identical entries', () => {
    const a = buildMilkDoc('feed', { date: 'd', amount: '5', currency: 'SYP' }); expect(entryFingerprint(a)).toBe(entryFingerprint({ ...a }))
  })
})
