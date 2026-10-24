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
  it('credit sale keeps customer and outstanding; settlement tags the customer', () => {
    const s = buildMilkDoc('sale', { date: 'd', liters: '10', pricePerL: '100', currency: 'SYP', collected: '400', customer: 'أبو أحمد' })
    expect(s.customer).toBe('أبو أحمد'); expect(s.outstanding).toBe(600)
    const r = buildMilkDoc('receipt', { date: 'd', amount: '600', currency: 'SYP', settlesCustomer: 'أبو أحمد' })
    expect(r.settlesCustomer).toBe('أبو أحمد'); expect(r.receiptsSYP).toBe(600)
  })
  it('wages entry keeps the worker name and builds a description', () => {
    const d = buildMilkDoc('wages', { date: 'd', amount: '50000', currency: 'SYP', workerName: 'محمود' })
    expect(d.workerName).toBe('محمود'); expect(d.description).toBe('أجر محمود'); expect(d.paymentsSYP).toBe(50000)
  })
  it('every entry computes net per currency like Milk_Box (blank when no cash)', () => {
    const pay = buildMilkDoc('feed', { date: 'd', amount: '100', currency: 'SYP' }); expect(pay.netSYP).toBe(-100); expect(pay.netUSD).toBeNull()
    const rec = buildMilkDoc('receipt', { date: 'd', amount: '40', currency: 'USD' }); expect(rec.netUSD).toBe(40); expect(rec.netSYP).toBeNull()
    expect(buildMilkDoc('production', { date: 'd', morningL: '5' }).netSYP).toBeNull()
    expect(buildMilkDoc('partnerExpense', { date: 'd', amount: '7', currency: 'USD', fundingSource: 'x' }).netUSD).toBeNull()
  })
  it('sale validation: price required, collected cannot exceed net, nothing collected leaves receipts blank', () => {
    const s = { date: 'd', liters: '10', currency: 'SYP' }
    expect(() => buildMilkDoc('sale', { ...s })).toThrow(/سعر/)
    expect(() => buildMilkDoc('sale', { ...s, pricePerL: '100', collected: '1001' })).toThrow(/أكبر/)
    expect(() => buildMilkDoc('sale', { ...s, pricePerL: '100', currency: '' })).toThrow(/العملة/)
    const credit = buildMilkDoc('sale', { ...s, pricePerL: '100', collected: '0' }); expect(credit.receiptsSYP).toBeNull(); expect(credit.outstanding).toBe(1000); expect(credit.netSYP).toBeNull()
  })
  it('zero amounts are rejected', () => expect(() => buildMilkDoc('payment', { date: 'd', amount: '0', currency: 'SYP' })).toThrow(/أكبر من صفر/))
  it('fingerprint identical for identical entries', () => {
    const a = buildMilkDoc('feed', { date: 'd', amount: '5', currency: 'SYP' }); expect(entryFingerprint(a)).toBe(entryFingerprint({ ...a }))
  })
})
