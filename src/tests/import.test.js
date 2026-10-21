import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { parseWorkbook, reconcile } from '../utils/excelParser.js'
const FILE = process.env.WORKBOOK || '/mnt/user-data/uploads/1792532426916_NEED_REVISION_Milk_Dashboard_Fixed.xlsx'
describe.skipIf(!existsSync(FILE))('workbook reconciliation (source file)', () => {
  it('matches the totals computed by Excel', async () => {
    const p = await parseWorkbook(FILE); const r = reconcile(p)
    expect(r.counts.milk).toBe(152)
    expect(r.counts.land).toBe(93)
    expect(r.land.USD).toBe(46851)
    expect(r.milk.receiptsSYP).toBe(64857000)
    expect(r.milk.paymentsSYP).toBe(66431400)
    expect(r.milk.partnerSYP).toBe(6700000)
    expect(r.milk.partnerUSD).toBe(670.5)
    expect(r.partnerExpenses.USD).toBe(670.5)
    expect(r.cattle.purchaseSYP).toBe(438500000)
    expect(r.ledgerOpening).toBe(17000000)
    expect(p.issues.some((i) => i.code === 'DUPLICATE_ID')).toBe(true)
  })
})
