
const val = (c) => { const v = c?.value; if (v && typeof v === 'object' && 'result' in v) return v.result; if (v && typeof v === 'object' && 'richText' in v) return v.richText.map((t) => t.text).join(''); return v ?? null }
const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : null)
const num = (v) => (blank(v) ? null : Number(v))

export async function parseWorkbook(source) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  if (typeof source === 'string') await wb.xlsx.readFile(source); else await wb.xlsx.load(source)
  const sheet = (name) => wb.getWorksheet(name)
  const issues = []
  const issue = (sheetName, row, code, msg) => issues.push({ sheet: sheetName, row, code, msg })

  // Milk_Box (header row 3, data from row 4). Blank != zero: null is preserved.
  const milk = []
  sheet('Milk_Box').eachRow((row, r) => {
    if (r < 4) return
    const g = (i) => val(row.getCell(i))
    const rec = { srcSheet: 'Milk_Box', srcRow: r, date: iso(g(1)), type: g(2), category: g(3), description: g(4), morningL: num(g(5)), eveningL: num(g(6)), liters: num(g(7)),
      pricePerL: num(g(8)), receiptsSYP: num(g(9)), paymentsSYP: num(g(10)), method: blank(g(12)) ? null : String(g(12)).trim(), notes: g(13), fundingSource: g(14),
      receiptsUSD: num(g(15)), paymentsUSD: num(g(16)), partnerAmount: num(g(17)), partnerCurrency: g(18) }
    const data = ['date', 'type', 'category', 'description', 'morningL', 'eveningL', 'liters', 'receiptsSYP', 'paymentsSYP', 'receiptsUSD', 'paymentsUSD', 'partnerAmount'].some((k) => !blank(rec[k]))
    if (!data) return
    if (!rec.date) issue('Milk_Box', r, 'NO_DATE', 'سجل بلا تاريخ')
    if (!blank(rec.liters) && (rec.morningL !== null || rec.eveningL !== null) && Math.abs(rec.liters - ((rec.morningL || 0) + (rec.eveningL || 0))) > 0.001)
      issue('Milk_Box', r, 'LITERS_MISMATCH', `الإجمالي المدخل ${rec.liters} لا يساوي صباح+مساء`)
    if ((rec.morningL !== null || rec.eveningL !== null) && blank(rec.liters)) issue('Milk_Box', r, 'LITERS_NOT_ENTERED', 'الإجمالي غير مدخل — يُحسب تلقائياً')
    milk.push(rec)
  })

  // Transactions (header row 1)
  const land = []
  sheet('Transactions').eachRow((row, r) => {
    if (r < 2) return
    const g = (i) => val(row.getCell(i)); if (blank(g(1))) return
    const rec = { srcSheet: 'Transactions', srcRow: r, id: g(1), date: iso(g(2)), stage: g(3), costType: g(4), category: g(5), description: g(6), partner: g(7), amount: num(g(8)), currency: g(9), status: g(10), detailLevel: g(11), source: g(12), subcategory: g(13) }
    if (!rec.date) issue('Transactions', r, 'NO_DATE', 'بلا تاريخ (لم يُخمَّن)')
    if (blank(rec.amount)) issue('Transactions', r, 'NO_AMOUNT', 'مبلغ ناقص')
    land.push(rec)
  })
  const idCount = {}; land.forEach((t) => (idCount[t.id] = (idCount[t.id] || 0) + 1))
  land.forEach((t) => { if (idCount[t.id] > 1) issue('Transactions', t.srcRow, 'DUPLICATE_ID', `المعرّف ${t.id} مكرر`) })

  // Cattle_Master (header row 3). Calf lives on the same row as its mother.
  const cattle = []
  sheet('Cattle_Master').eachRow((row, r) => {
    if (r < 4) return
    const g = (i) => val(row.getCell(i)); if (blank(g(1)) && blank(g(10))) return
    cattle.push({ srcSheet: 'Cattle_Master', srcRow: r, animalId: g(1), name: g(2), category: g(3), purchaseDate: iso(g(4)), purchasePrice: num(g(5)), currency: g(6), status: g(7), hasCalf: g(8),
      baselineMilkL: num(g(9)), calfId: g(10), calfCategory: g(11), calfStatus: g(12), birthRaw: g(13), parentRef: g(14), source: g(15), notes: g(16), health: g(17) })
  })
  const ids = {}; cattle.forEach((c) => { ids[c.animalId] = (ids[c.animalId] || 0) + 1 })
  cattle.forEach((c) => { if (ids[c.animalId] > 1) issue('Cattle_Master', c.srcRow, 'DUPLICATE_ANIMAL', c.animalId)
    if (c.animalId && !/^[A-Z]\d{3}$/.test(c.animalId)) issue('Cattle_Master', c.srcRow, 'ID_FORMAT', `${c.animalId} لا يطابق النمط A001`) })

  // Hidden Partner-Depts
  const partnerExpenses = []
  sheet('Partner-Depts').eachRow((row, r) => {
    if (r < 2) return; const g = (i) => val(row.getCell(i))
    if (typeof g(2) !== 'number') return // skips the "ملاحظة تنظيمية" row
    partnerExpenses.push({ srcSheet: 'Partner-Depts', srcRow: r, partner: g(1), amount: num(g(2)), currency: g(3), type: g(4), notes: g(5) })
  })

  // Partner_Ledger: only rows with data in A–F
  const ledger = []
  sheet('Partner_Ledger').eachRow((row, r) => {
    if (r < 4) return; const g = (i) => val(row.getCell(i))
    if (![1, 2, 3, 4, 5, 6].some((i) => !blank(g(i)))) return
    ledger.push({ srcSheet: 'Partner_Ledger', srcRow: r, date: iso(g(1)), partner: g(2), type: g(3), description: g(4), additionSYP: num(g(5)), repaymentSYP: num(g(6)), notes: g(8) })
  })

  // Lists
  const lists = {}; const L = sheet('Lists')
  for (let c = 1; c <= 16; c++) { const name = val(L.getRow(1).getCell(c)); if (blank(name)) continue
    lists[name] = []; for (let r = 2; r <= 40; r++) { const v = val(L.getRow(r).getCell(c)); if (!blank(v)) lists[name].push(v) } }

  // Cross-record: partner-funded rows duplicated in Milk_Box and Partner-Depts
  const mbPartner = milk.filter((m) => m.partnerAmount !== null)
  if (mbPartner.length === partnerExpenses.length) issue('Partner-Depts', null, 'MIRRORED', `${partnerExpenses.length} بند منقول إلى Milk_Box (العمودان Q/R) — يُستورد مرة واحدة كمصروف شريك ولا يُعدّ مرتين`)

  return { milk, land, cattle, partnerExpenses, ledger, lists, issues }
}

export function reconcile(p) {
  const sum = (a, k, f = () => true) => a.filter(f).reduce((s, x) => s + (x[k] || 0), 0)
  return {
    counts: { milk: p.milk.length, land: p.land.length, cattle: p.cattle.length, partnerExpenses: p.partnerExpenses.length, ledger: p.ledger.length },
    milk: { receiptsSYP: sum(p.milk, 'receiptsSYP'), paymentsSYP: sum(p.milk, 'paymentsSYP'), receiptsUSD: sum(p.milk, 'receiptsUSD'), paymentsUSD: sum(p.milk, 'paymentsUSD'),
      partnerSYP: sum(p.milk, 'partnerAmount', (x) => x.partnerCurrency === 'SYP'), partnerUSD: sum(p.milk, 'partnerAmount', (x) => x.partnerCurrency === 'USD') },
    land: { USD: sum(p.land, 'amount', (x) => x.currency === 'USD'), SYP: sum(p.land, 'amount', (x) => x.currency === 'SYP') },
    cattle: { purchaseSYP: sum(p.cattle, 'purchasePrice', (x) => x.currency === 'SYP'), purchaseUSD: sum(p.cattle, 'purchasePrice', (x) => x.currency === 'USD') },
    partnerExpenses: { USD: sum(p.partnerExpenses, 'amount', (x) => x.currency === 'USD'), SYP: sum(p.partnerExpenses, 'amount', (x) => x.currency === 'SYP') },
    ledgerOpening: sum(p.ledger, 'additionSYP', (x) => x.type === 'رصيد افتتاحي'),
  }
}
