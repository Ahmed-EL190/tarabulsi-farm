// Pure mapping from parsed workbook -> Firestore documents (deterministic IDs => re-import is idempotent).
import { COL } from '../services/collections'
const hasAny = (...v) => v.some((x) => x !== null && x !== undefined)
export const LIST_KEYS = { 'الشريك': 'partners', 'المرحلة': 'stages', 'نوع التكلفة': 'costTypes', 'التصنيف': 'landCategories', 'الحالة': 'statuses', 'مستوى السجل': 'detailLevels', 'العملة': 'currencies', 'التصنيف الفرعي': 'subcategories', 'حالة الحيوان': 'animalStatuses', 'فئة الحيوان': 'animalCategories', 'حالة الحليب': 'milkStatuses', 'نوع الحركة': 'txTypes', 'وحدة العلف': 'feedUnits' }

export function mapWorkbook(p, jobId) {
  const src = (r) => ({ srcSheet: r.srcSheet, srcRow: r.srcRow, importJobId: jobId })
  const docs = []
  const mirroredMilk = []
  for (const r of p.milk) {
    const liters = r.morningL !== null || r.eveningL !== null ? (r.morningL ?? 0) + (r.eveningL ?? 0) : r.liters // documented transformation: Milk_Box!G formula intent
    const id = `mb_${r.srcRow}`
    const d = { ...src(r), date: r.date, type: r.type, category: r.category, description: r.description, morningL: r.morningL, eveningL: r.eveningL, liters, pricePerL: r.pricePerL,
      receiptsSYP: r.receiptsSYP, paymentsSYP: r.paymentsSYP, receiptsUSD: r.receiptsUSD, paymentsUSD: r.paymentsUSD, method: r.method, notes: r.notes ?? '', fundingSource: r.fundingSource,
      partnerAmount: r.partnerAmount, partnerCurrency: r.partnerCurrency,
      netSYP: hasAny(r.receiptsSYP, r.paymentsSYP) ? (r.receiptsSYP ?? 0) - (r.paymentsSYP ?? 0) : null, netUSD: hasAny(r.receiptsUSD, r.paymentsUSD) ? (r.receiptsUSD ?? 0) - (r.paymentsUSD ?? 0) : null }
    if (r.liters !== null && liters !== r.liters) d.sourceLiters = r.liters // preserve the original conflicting value
    docs.push({ col: COL.milk, id, data: d }); if (r.partnerAmount !== null) mirroredMilk.push(id)
  }
  for (const r of p.land) docs.push({ col: COL.land, id: `tx_${r.srcRow}`, data: { ...src(r), code: r.id, date: r.date, stage: r.stage, costType: r.costType, category: r.category, description: r.description, partner: r.partner, amount: r.amount, currency: r.currency, status: r.status, detailLevel: r.detailLevel, source: r.source ?? '', subcategory: r.subcategory } })
  for (const r of p.cattle) {
    const id = String(r.animalId).trim().toUpperCase()
    docs.push({ col: COL.cattle, id, data: { ...src(r), animalId: id, name: r.name, category: r.category, purchaseDate: r.purchaseDate, purchasePrice: r.purchasePrice, currency: r.currency, status: r.status, hasCalf: r.hasCalf, baselineMilkL: r.baselineMilkL,
      birthRaw: r.birthRaw ?? null, source: r.source ?? null, notes: r.notes ?? '', health: r.health ?? null, date: r.purchaseDate || '' , parentRefRaw: r.parentRef ?? null } })
    if (r.calfId) {
      const m = /^\s*([A-Za-z0-9]+)\s*(?:\((.*)\))?\s*$/.exec(String(r.calfId)); const cid = (m ? m[1] : String(r.calfId)).toUpperCase()
      docs.push({ col: COL.cattle, id: cid, data: { ...src(r), animalId: cid, name: m?.[2] ?? '', category: r.calfCategory, status: r.calfStatus, motherId: id, birthRaw: r.birthRaw ?? null, purchasePrice: null, currency: null, calfIdRaw: r.calfId, date: '' } })
    }
  }
  p.partnerExpenses.forEach((r, i) => docs.push({ col: COL.partnerExpenses, id: `pd_${r.srcRow}`, data: { ...src(r), date: null, partner: r.partner, type: r.type, amount: r.amount, currency: r.currency, reimbursement: 'غير مسدد', notes: r.notes ?? '', milkRef: mirroredMilk.length === p.partnerExpenses.length ? `mb_${p.milk.filter((m) => m.partnerAmount !== null)[i].srcRow}` : null } }))
  for (const r of p.ledger) docs.push({ col: COL.ledger, id: `pl_${r.srcRow}`, data: { ...src(r), date: r.date, partner: r.partner, type: r.type, description: r.description, additionSYP: r.additionSYP, repaymentSYP: r.repaymentSYP, notes: r.notes ?? '' } })
  const lists = {}
  for (const [name, items] of Object.entries(p.lists)) if (LIST_KEYS[name]) lists[LIST_KEYS[name]] = { items, disabled: [] }
  return { docs, lists }
}
