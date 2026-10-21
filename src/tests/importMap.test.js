import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { parseWorkbook, reconcile } from '../utils/excelParser.js'
import { mapWorkbook } from '../utils/importMap.js'
const FILE = process.env.WORKBOOK || '/mnt/user-data/uploads/1792532426916_NEED_REVISION_Milk_Dashboard_Fixed.xlsx'
describe.skipIf(!existsSync(FILE))('import mapping', () => {
  it('produces unique deterministic ids, links calves and mirrored partner rows', async () => {
    const p = await parseWorkbook(FILE); const { docs, lists } = mapWorkbook(p, 'job1')
    const keys = docs.map((d) => `${d.col}/${d.id}`); expect(new Set(keys).size).toBe(keys.length)
    const calf = docs.find((d) => d.col === 'cattle' && d.id === 'C002'); expect(calf.data.motherId).toBe('A002'); expect(calf.data.name).toBe('بطاح')
    const pd = docs.filter((d) => d.col === 'partnerExpenses'); expect(pd).toHaveLength(17); expect(pd.every((d) => d.data.milkRef)).toBe(true)
    expect(docs.filter((d) => d.col === 'cattle')).toHaveLength(21)
    expect(lists.partners.items).toEqual(['أبو وليد', 'أبو غفير'])
    // idempotent: second mapping gives identical ids
    expect(mapWorkbook(p, 'job1').docs.map((d) => d.id)).toEqual(docs.map((d) => d.id))
  })
  it('milk docs compute missing totals from morning+evening', async () => {
    const p = await parseWorkbook(FILE); const { docs } = mapWorkbook(p, 'j')
    const r125 = docs.find((d) => d.id === 'mb_125').data; expect(r125.liters).toBe(154.5); expect(r125.sourceLiters).toBeUndefined()
    const sumSYP = docs.filter((d) => d.col === 'milkTransactions').reduce((s, d) => s + (d.data.netSYP || 0), 0)
    expect(sumSYP).toBe(64857000 - 66431400)
  })
})
