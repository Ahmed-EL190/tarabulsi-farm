import { describe, it, expect } from 'vitest'
import { buildMilkDoc, entryFingerprint } from '../utils/entryMapping.js'
const D = '2026-10-20'
const fp = (k, o) => entryFingerprint(buildMilkDoc(k, { date: D, currency: 'SYP', ...o }))
describe('duplicate fingerprint', () => {
  it('identical entries match (accidental double submit is caught)', () => { expect(fp('feed', { amount: '5' })).toBe(fp('feed', { amount: '5' })); expect(fp('sale', { liters: '10', pricePerL: '100' })).toBe(fp('sale', { liters: '10', pricePerL: '100' })) })
  it('different price / discount / currency / method / partner are NOT duplicates', () => {
    expect(fp('sale', { liters: '100', pricePerL: '6500', collected: '300000', description: 'زبون' })).not.toBe(fp('sale', { liters: '100', pricePerL: '7000', collected: '300000', description: 'زبون' }))
    expect(fp('sale', { liters: '100', pricePerL: '100', discount: '0', collected: '5000' })).not.toBe(fp('sale', { liters: '100', pricePerL: '100', discount: '5000', collected: '5000' }))
    expect(fp('feed', { amount: '10' })).not.toBe(fp('feed', { amount: '10', currency: 'USD' }))
    expect(fp('feed', { amount: '10', method: 'نقد' })).not.toBe(fp('feed', { amount: '10', method: 'تحويل' }))
    expect(fp('partnerExpense', { amount: '10', currency: 'USD', fundingSource: 'أبو وليد' })).not.toBe(fp('partnerExpense', { amount: '10', currency: 'USD', fundingSource: 'أبو غفير' }))
  })
  it('different date / category / amount differ', () => {
    expect(entryFingerprint(buildMilkDoc('feed', { date: '2026-10-21', amount: '5', currency: 'SYP' }))).not.toBe(fp('feed', { amount: '5' }))
    expect(fp('feed', { amount: '5' })).not.toBe(fp('wages', { amount: '5' })); expect(fp('feed', { amount: '5' })).not.toBe(fp('feed', { amount: '6' }))
  })
  it('no separator collisions', () => { const a = { date: 'd', type: 't', category: 'c', description: 'x|y' }; const b = { date: 'd', type: 't', category: 'c|x', description: 'y' }; expect(entryFingerprint(a)).not.toBe(entryFingerprint(b)) })
  it('works on old/imported docs that have no fp or entryKind', () => {
    const fresh = buildMilkDoc('feed', { date: D, amount: '5', currency: 'SYP', description: 'علف' }); const { entryKind, expAmount, expCurrency, paymentStatus, payer, payableAmount, ...imported } = fresh
    expect(entryFingerprint(imported)).toBe(entryFingerprint(fresh))
  })
  it('legitimate repeated transactions with different amounts are allowed', () => { expect(fp('payment', { amount: '100', description: 'عامل' })).not.toBe(fp('payment', { amount: '150', description: 'عامل' })) })
})
