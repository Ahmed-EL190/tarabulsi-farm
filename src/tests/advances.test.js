import { describe, it, expect } from 'vitest'
import { advanceBalances, validateAdvance, balanceOf, cashDirection } from '../utils/advances.js'
import { expensesByCategory, cashSummary } from '../utils/finance.js'
const E = (o) => ({ personType: 'عامل', person: 'محمود', currency: 'SYP', archived: false, ...o })
describe('advances', () => {
  const list = [E({ type: 'سلفة', amount: 500000 }), E({ type: 'سداد', amount: 200000 }), E({ type: 'خصم من الأجر', amount: 100000 }), E({ type: 'سلفة', amount: 50, currency: 'USD' })]
  it('balance = advances - repayments - deductions, per currency', () => {
    const b = advanceBalances(list)
    expect(b.find((x) => x.currency === 'SYP')).toMatchObject({ advanced: 500000, repaid: 300000, balance: 200000 })
    expect(b.find((x) => x.currency === 'USD').balance).toBe(50)
  })
  it('archived entries are ignored', () => expect(balanceOf([...list, E({ type: 'سلفة', amount: 999, archived: true })], 'عامل', 'محمود', 'SYP')).toBe(200000))
  it('repayment cannot exceed what is owed', () => {
    const base = { personType: 'عامل', person: 'محمود', currency: 'SYP', date: '2026-10-01' }
    expect(validateAdvance(list, { ...base, type: 'سداد', amount: 200001 })).toMatch(/يتجاوز/)
    expect(validateAdvance(list, { ...base, type: 'سداد', amount: 200000 })).toBeNull()
    expect(validateAdvance(list, { ...base, type: 'تعديل خصم', amount: 1 })).toMatch(/تفسير/)
    expect(validateAdvance(list, { ...base, type: 'تعديل خصم', amount: 1, notes: 'تصحيح' })).toBeNull()
  })
  it('wage deduction is workers only; partners advance works', () => {
    expect(validateAdvance([], { personType: 'شريك', person: 'أبو وليد', currency: 'SYP', date: 'd', type: 'خصم من الأجر', amount: 1 })).toMatch(/للعمال/)
    expect(validateAdvance([], { personType: 'شريك', person: 'أبو وليد', currency: 'SYP', date: 'd', type: 'سلفة', amount: 1 })).toBeNull()
  })
  it('cash direction', () => { expect(cashDirection('سلفة')).toBe('out'); expect(cashDirection('سداد')).toBe('in'); expect(cashDirection('خصم من الأجر')).toBeNull() })
  it('advance cash rows move cash but are not expenses', () => {
    const rows = [{ category: 'سلف', isAdvance: true, paymentsSYP: 500000 }, { category: 'علف', paymentsSYP: 100 }]
    expect(cashSummary(rows).SYP.payments).toBe(500100)
    expect(expensesByCategory(rows)).toEqual({ 'علف': { SYP: 100, USD: 0 } })
  })
})
