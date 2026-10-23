/**
 * Pure planner: decides how the partnerExpenses rows linked (milkRef) to a milk/cash document must change
 * so both collections stay consistent after create / edit / archive. Executed atomically by services/milkLinks.js.
 * linked = non-archived partnerExpenses docs whose milkRef === milkId.
 */
export function planPartnerLink({ milkId, doc, linked = [], archiving = false }) {
  const ops = []
  const wants = !archiving && doc && doc.partnerAmount != null && Number(doc.partnerAmount) > 0
  if (!wants) { linked.forEach((l) => ops.push({ op: 'archive', id: l.id })); return ops }
  const fields = { date: doc.date ?? null, partner: doc.fundingSource ?? null, type: doc.description || doc.category || '', amount: doc.partnerAmount, currency: doc.partnerCurrency ?? null, milkRef: milkId, notes: doc.notes || '' }
  if (linked.length) { ops.push({ op: 'update', id: linked[0].id, data: fields }); linked.slice(1).forEach((l) => ops.push({ op: 'archive', id: l.id })) }
  else ops.push({ op: 'create', id: `pe_${milkId}`, data: { ...fields, reimbursement: 'غير مسدد' } })
  return ops
}
