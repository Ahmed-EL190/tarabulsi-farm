import { describe, it, expect } from 'vitest'
import { buildMilkDoc } from '../utils/entryMapping.js'
import { expensesCfg } from '../features/milk/configs.jsx'
import { landCfg } from '../features/land/configs.js'
import { cashSummary, expensesByCategory, expenseSummary, vetRecords } from '../utils/finance.js'
import { planPartnerLink } from '../utils/partnerLink.js'
import { purchaseCashDoc } from '../services/cattle.js'
const base = { date: '2026-10-20', category: 'علف', currency: 'SYP', paymentStatus: 'مدفوع', payer: 'صندوق المزرعة' }
describe('expenses page prepare', () => {
  it('unpaid expense: payable only, no cash, appears in expenseSummary but not in cash', () => {
    const d = expensesCfg.prepare({ ...base, amount: '500000', paymentStatus: 'مستحق' })
    expect(d.payableAmount).toBe(500000); expect(d.paymentsSYP).toBeNull(); expect(cashSummary([d]).SYP.payments).toBe(0)
    expect(expenseSummary([d]).علف.SYP).toEqual({ incurred: 500000, paid: 0, partnerFunded: 0, payable: 500000 })
  })
  it('paid by farm / by partner / no stale net of the other currency', () => {
    const f = expensesCfg.prepare({ ...base, amount: '100' }); expect(f.paymentsSYP).toBe(100); expect(f.netSYP).toBe(-100); expect(f.netUSD).toBeNull()
    const p = expensesCfg.prepare({ ...base, amount: '50', currency: 'USD', payer: 'شريك', fundingSource: 'أبو وليد' }); expect(p.partnerAmount).toBe(50); expect(p.paymentsUSD).toBeNull(); expect(p.netUSD).toBeNull()
    expect(() => expensesCfg.prepare({ ...base, amount: '50', payer: 'شريك' })).toThrow('الشريك')
  })
  it('rejects bad amounts/dates/currency', () => { for (const o of [{ amount: 'abc' }, { amount: '0' }, { amount: '-5' }, { amount: '5', date: '' }, { amount: '5', currency: 'EUR' }, { amount: '5', paymentStatus: '' }]) expect(() => expensesCfg.prepare({ ...base, ...o })).toThrow() })
  it('edit form maps legacy / daily-entry rows to form fields', () => {
    const row = buildMilkDoc('feed', { date: '2026-10-20', amount: '77', currency: 'USD' }); const f = expensesCfg.toForm(row); expect(f).toMatchObject({ amount: 77, currency: 'USD', payer: 'صندوق المزرعة' })
    const imported = expensesCfg.toForm({ date: '2026-10-20', category: 'علف', paymentsSYP: 900 }); expect(imported).toMatchObject({ amount: 900, currency: 'SYP', paymentStatus: 'مدفوع' })
  })
})
describe('expense accounting', () => {
  const rows = [
    { category: 'علف', paymentsSYP: 100 }, { category: 'علف', partnerAmount: 13, partnerCurrency: 'USD' },
    { category: 'علف', paymentStatus: 'مستحق', payableAmount: 40, expCurrency: 'SYP' },
    { category: 'أخرى', entryKind: 'partnerRepayment', paymentsSYP: 5000 },
  ]
  it('incurred = paid + partner + payable; cash only counts paid', () => {
    const s = expenseSummary(rows); expect(s.علف.SYP).toEqual({ incurred: 140, paid: 100, partnerFunded: 0, payable: 40 }); expect(s.علف.USD).toEqual({ incurred: 13, paid: 0, partnerFunded: 13, payable: 0 })
    expect(cashSummary(rows).SYP.payments).toBe(5100)
  })
  it('partner repayment is not an expense (no double count of partner-paid expense)', () => { expect(expenseSummary(rows).أخرى).toBeUndefined(); expect(expensesByCategory(rows).أخرى).toBeUndefined() })
  it('rounding in summaries', () => { expect(expenseSummary([{ category: 'x', paymentsSYP: 0.1 }, { category: 'x', paymentsSYP: 0.2 }]).x.SYP.paid).toBe(0.3) })
})
describe('vet report', () => {
  const tx = [{ category: 'دواء وعلاج', date: '2026-10-05', paymentsSYP: 1000, description: 'حقنة' }, { category: 'علف', date: '2026-10-05', paymentsSYP: 5 }]
  const events = [{ type: 'علاج', animalId: 'A001', date: '2026-10-06', amount: 300, currency: 'SYP' }, { type: 'علاج', animalId: 'A002', date: '2026-10-07', amount: 900, currency: 'SYP', linkedMilkId: 'm1' }, { type: 'علاج', animalId: 'A003', date: '2026-09-01' }, { type: 'بيع', animalId: 'A004', date: '2026-10-08' }]
  it('adds non-cash treatment events, skips linked (no double count), out-of-range and non-treatment', () => {
    const r = vetRecords(tx, events, '2026-10-01', '2026-10-31'); expect(r).toHaveLength(2); expect(r.map((x) => x.date)).toEqual(['2026-10-06', '2026-10-05']); expect(r[0].eventAmount).toBe(300)
  })
})
describe('partner link planner (cash doc <-> partnerExpenses)', () => {
  const doc = { date: '2026-10-20', partnerAmount: 50, partnerCurrency: 'USD', fundingSource: 'أبو وليد', description: 'علف', category: 'علف' }
  it('creates a deterministic linked row', () => { const ops = planPartnerLink({ milkId: 'm1', doc }); expect(ops).toHaveLength(1); expect(ops[0]).toMatchObject({ op: 'create', id: 'pe_m1', data: { milkRef: 'm1', partner: 'أبو وليد', amount: 50, currency: 'USD', reimbursement: 'غير مسدد' } }) })
  it('edit updates the existing link instead of duplicating', () => { const ops = planPartnerLink({ milkId: 'm1', doc: { ...doc, partnerAmount: 70 }, linked: [{ id: 'pd_9' }] }); expect(ops).toEqual([{ op: 'update', id: 'pd_9', data: expect.objectContaining({ amount: 70, milkRef: 'm1' }) }]) })
  it('stray extra links are archived', () => { expect(planPartnerLink({ milkId: 'm1', doc, linked: [{ id: 'a' }, { id: 'b' }] }).map((o) => o.op)).toEqual(['update', 'archive']) })
  it('changing payer from partner to farm archives the link', () => { expect(planPartnerLink({ milkId: 'm1', doc: { ...doc, partnerAmount: null }, linked: [{ id: 'a' }] })).toEqual([{ op: 'archive', id: 'a' }]) })
  it('archiving the cash doc archives its links (no stale records)', () => { expect(planPartnerLink({ milkId: 'm1', doc, linked: [{ id: 'a' }], archiving: true })).toEqual([{ op: 'archive', id: 'a' }]); expect(planPartnerLink({ milkId: 'm1', doc: null, linked: [], archiving: true })).toEqual([]) })
})
describe('cattle purchase cash document', () => {
  it('is a cash payment in the purchase currency and shows on the Expenses page', () => {
    const d = purchaseCashDoc({ animalId: 'A010', name: 'نجمة' }, 12000000, 'SYP', '2026-10-01')
    expect(d).toMatchObject({ type: 'مدفوعات', category: 'شراء حيوان', paymentsSYP: 12000000, netSYP: -12000000, expAmount: 12000000, expCurrency: 'SYP', linkedAnimalId: 'A010', entryKind: 'cattlePurchase' }); expect(d.paymentsUSD).toBeUndefined()
    expect(cashSummary([d]).SYP.net).toBe(-12000000)
  })
})
describe('reconciliation with known sample transactions', () => {
  const D = '2026-10-31'
  const rows = [
    buildMilkDoc('sale', { date: D, liters: '100', pricePerL: '6500', discount: '50000', collected: '400000', currency: 'SYP' }),     // net 600000, collected 400000, outstanding 200000
    buildMilkDoc('sale', { date: '2026-11-01', liters: '10', pricePerL: '2', currency: 'USD' }),                                        // month-end spill: USD 20 fully collected
    buildMilkDoc('feed', { date: D, amount: '150000', currency: 'SYP' }),
    buildMilkDoc('partnerExpense', { date: D, amount: '30', currency: 'USD', fundingSource: 'أبو وليد', category: 'علف' }),
  ]
  it('cash vs accrual are reconciled and documented', () => {
    const cash = cashSummary(rows); expect(cash.SYP).toEqual({ receipts: 400000, payments: 150000, net: 250000 }); expect(cash.USD).toEqual({ receipts: 20, payments: 0, net: 20 })
    const exp = expenseSummary(rows); expect(exp.علف.SYP.incurred).toBe(150000); expect(exp.علف.USD).toEqual({ incurred: 30, paid: 0, partnerFunded: 30, payable: 0 })
    expect(rows[0].outstanding).toBe(200000)
  })
  it('month-end split by date string', () => { const oct = rows.filter((r) => r.date <= '2026-10-31'); expect(cashSummary(oct).USD.receipts).toBe(0); expect(cashSummary(rows).USD.receipts).toBe(20) })
})
describe('land config validation', () => {
  const v = { stage: 'a', costType: 'b', category: 'c', description: 'd', partner: 'p', amount: '100', currency: 'USD', status: 's', detailLevel: 'l' }
  it('accepts valid and negative adjustments; rejects NaN, bad currency/date', () => { expect(landCfg.prepare(v).amount).toBe(100); expect(landCfg.prepare({ ...v, amount: '-25' }).amount).toBe(-25); expect(landCfg.prepare(v).date).toBeNull(); for (const o of [{ amount: 'abc' }, { amount: '' }, { currency: 'EUR' }, { date: '2026-02-30' }, { amount: '1.234' }]) expect(() => landCfg.prepare({ ...v, ...o })).toThrow() })
})
