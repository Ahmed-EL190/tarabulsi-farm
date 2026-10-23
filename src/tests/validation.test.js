import { describe, it, expect } from 'vitest'
import { parseNumber, round, mulMoney, isValidDate, requireCurrency, localToday } from '../utils/money.js'
import { buildMilkDoc } from '../utils/entryMapping.js'
import { prepareMilkDoc } from '../utils/docs.js'
const D = '2026-10-20'
const sale = (o) => buildMilkDoc('sale', { date: D, currency: 'SYP', liters: '10', pricePerL: '100', ...o })
describe('parseNumber', () => {
  it('accepts normal values and empty', () => { expect(parseNumber('12.5', 'x')).toBe(12.5); expect(parseNumber('', 'x')).toBeNull(); expect(parseNumber(0, 'x', { min: 0 })).toBe(0) })
  it.each(['abc', 'NaN', 'Infinity', '1e3', '1,000', '--5', '0x10', '5.'])('rejects %s', (v) => expect(() => parseNumber(v, 'x')).toThrow())
  it('rejects non-finite numbers', () => { expect(() => parseNumber(NaN, 'x')).toThrow(); expect(() => parseNumber(Infinity, 'x')).toThrow() })
  it('required / min / positive / decimals', () => {
    expect(() => parseNumber('', 'x', { required: true })).toThrow(); expect(() => parseNumber('-1', 'x', { min: 0 })).toThrow()
    expect(() => parseNumber('0', 'x', { positive: true })).toThrow(); expect(() => parseNumber('1.234', 'x', { maxDecimals: 2 })).toThrow(); expect(parseNumber('1.23', 'x', { maxDecimals: 2 })).toBe(1.23)
  })
})
describe('rounding and dates', () => {
  it('avoids float noise', () => { expect(mulMoney(3, 0.1)).toBe(0.3); expect(round(1.005)).toBe(1.01); expect(round(-1.005)).toBe(-1.01); expect(round(0.1 + 0.2)).toBe(0.3) })
  it('validates real calendar dates', () => {
    expect(isValidDate('2026-02-28')).toBe(true); expect(isValidDate('2028-02-29')).toBe(true)
    for (const bad of ['2026-02-30', '2026-13-01', '31/02/abc', '', null, '2026-1-1', '1999-01-01']) expect(isValidDate(bad)).toBe(false)
  })
  it('currency', () => { expect(requireCurrency('USD')).toBe('USD'); expect(() => requireCurrency('EUR')).toThrow(); expect(() => requireCurrency('')).toThrow() })
  it('localToday is YYYY-MM-DD', () => expect(isValidDate(localToday())).toBe(true))
})
describe('sale validation', () => {
  it('normal sale with discount', () => { const d = sale({ discount: '100' }); expect(d.saleNet).toBe(900); expect(d.receiptsSYP).toBe(900); expect(d.outstanding).toBe(0); expect(d.discount).toBe(100) })
  it('partial payment leaves outstanding; zero collected = fully on credit', () => {
    expect(sale({ collected: '300' }).outstanding).toBe(700); const z = sale({ collected: '0' }); expect(z.receiptsSYP).toBe(0); expect(z.outstanding).toBe(1000)
  })
  it('boundary: discount equal to total is allowed (free), greater is not', () => { expect(sale({ discount: '1000' }).saleNet).toBe(0); expect(() => sale({ discount: '1000.01' })).toThrow('الخصم') })
  it('rejects zero/negative/missing price and quantity', () => { for (const o of [{ pricePerL: '' }, { pricePerL: '0' }, { pricePerL: '-50' }, { liters: '0' }, { liters: '-1' }, { liters: '' }]) expect(() => sale(o)).toThrow() })
  it('rejects NaN, Infinity, negative or excessive collected', () => { for (const o of [{ liters: 'abc' }, { liters: 'Infinity' }, { collected: '-300' }, { collected: '1001' }, { collected: 'x' }]) expect(() => sale(o)).toThrow() })
  it('rounds totals and rejects over-precise money', () => { expect(sale({ liters: '3', pricePerL: '0.1' }).saleNet).toBe(0.3); expect(() => sale({ discount: '1.005' })).toThrow(); expect(() => sale({ collected: '1.234' })).toThrow() })
  it('USD sale never touches SYP', () => { const d = sale({ currency: 'USD' }); expect(d.receiptsUSD).toBe(1000); expect(d.receiptsSYP).toBeNull() })
  it('rejects unsupported currency and invalid date', () => { expect(() => sale({ currency: 'EUR' })).toThrow(); expect(() => buildMilkDoc('feed', { date: '31/02/abc', amount: '5', currency: 'SYP' })).toThrow(); expect(() => buildMilkDoc('feed', { amount: '5', currency: 'SYP' })).toThrow() })
})
describe('other entries', () => {
  it('rejects NaN/zero/negative amounts and missing currency', () => { for (const a of ['xyz', '0', '-5', '']) expect(() => buildMilkDoc('feed', { date: D, amount: a, currency: 'SYP' })).toThrow(); expect(() => buildMilkDoc('feed', { date: D, amount: '5' })).toThrow('العملة') })
  it('production rejects NaN / negative / empty', () => { for (const m of ['abc', '-1']) expect(() => buildMilkDoc('production', { date: D, morningL: m })).toThrow(); expect(() => buildMilkDoc('production', { date: D })).toThrow() })
  it('partner expense needs a partner', () => expect(() => buildMilkDoc('partnerExpense', { date: D, amount: '5', currency: 'USD' })).toThrow('الشريك'))
})
describe('prepareMilkDoc (cashbook edit form)', () => {
  it('computes totals and nets with rounding', () => { const d = prepareMilkDoc({ date: D, morningL: '1', eveningL: '2.5', receiptsSYP: '100', paymentsSYP: '40.5' }); expect(d.liters).toBe(3.5); expect(d.netSYP).toBe(59.5); expect(d.netUSD).toBeNull() })
  it('rejects NaN, Infinity, negatives, bad date', () => { for (const o of [{ receiptsSYP: 'abc' }, { receiptsSYP: 'Infinity' }, { receiptsSYP: '-100' }, { date: '' }, { date: '2026-02-30' }]) expect(() => prepareMilkDoc({ date: D, ...o })).toThrow() })
  it('partner amount needs currency and partner', () => { expect(() => prepareMilkDoc({ date: D, partnerAmount: '5' })).toThrow(); expect(() => prepareMilkDoc({ date: D, partnerAmount: '5', partnerCurrency: 'USD' })).toThrow('الشريك') })
})
