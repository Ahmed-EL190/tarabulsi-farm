import { describe, it, expect } from 'vitest'
import { baseSalary, calcPayroll, statusFor, validatePayment, payrollTotals, remaining } from '../utils/payroll.js'
const m = { payType: 'شهري', rate: 1000000, currency: 'SYP', bonus: 0, otherDeduction: 0, advanceDeduction: 0 }
describe('payroll', () => {
  it('base: monthly = rate, daily = rate x days', () => { expect(baseSalary('شهري', 1000000, 0)).toBe(1000000); expect(baseSalary('يومي', 50000, 26)).toBe(1300000) })
  it('net = base + bonus - other deductions - advance deduction', () => {
    const r = calcPayroll({ ...m, bonus: 100000, otherDeduction: 50000, otherDeductionReason: 'غياب', advanceDeduction: 300000 }, 500000)
    expect(r.calc).toEqual({ base: 1000000, gross: 1100000, net: 750000 })
  })
  it('advance deduction cannot exceed the outstanding advance', () => expect(calcPayroll({ ...m, advanceDeduction: 600000 }, 500000).error).toMatch(/يتجاوز/))
  it('deductions cannot exceed gross; reason required; daily needs days', () => {
    expect(calcPayroll({ ...m, advanceDeduction: 1000001 }, 2e6).error).toMatch(/أكبر/)
    expect(calcPayroll({ ...m, otherDeduction: 10 }, 0).error).toMatch(/سبب/)
    expect(calcPayroll({ ...m, payType: 'يومي', rate: 50000 }, 0).error).toMatch(/أيام/)
    expect(calcPayroll({ ...m, currency: '' }, 0).error).toMatch(/العملة/)
  })
  it('status and remaining follow payments; overpayment rejected', () => {
    const p = { net: 750000, paid: 0 }
    expect(statusFor(750000, 0)).toBe('مستحق'); expect(statusFor(750000, 100)).toBe('مدفوع جزئياً'); expect(statusFor(750000, 750000)).toBe('مدفوع')
    expect(validatePayment(p, 750001)).toMatch(/يتجاوز/); expect(validatePayment(p, 750000)).toBeNull(); expect(remaining({ net: 5, paid: 9 })).toBe(0)
  })
  it('totals are per currency and ignore archived sheets', () => {
    const t = payrollTotals([{ currency: 'SYP', net: 100, paid: 40, base: 100 }, { currency: 'USD', net: 50, paid: 50, base: 50 }, { currency: 'SYP', net: 999, paid: 0, archived: true }])
    expect(t.SYP).toMatchObject({ net: 100, paid: 40, remaining: 60 }); expect(t.USD.remaining).toBe(0)
  })
})
