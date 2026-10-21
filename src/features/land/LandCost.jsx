import { useMemo, useState } from 'react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { COL } from '../../services/db'
import { landCostReport } from '../../utils/finance'
import { exportRows } from '../../utils/exportExcel'
import { Modal, PageHeader, fmtNum } from '../../components/ui'
import { Download } from 'lucide-react'

export default function LandCost() {
  const { rows } = useCollection(COL.land); const lists = useLists(); const [drill, setDrill] = useState(null)
  const partners = lists.partners.items
  const cats = useMemo(() => { const s = new Set(lists.landCategories.items.filter((c) => ['ثمن شراء الأرض', 'مصاريف اقتناء الأرض', 'مصاريف تجهيز الأرض'].includes(c))); rows.forEach((r) => s.add(r.category)); return [...s] }, [rows, lists])
  const rep = useMemo(() => landCostReport(rows, cats, partners), [rows, cats, partners])
  const cell = (cat, partner, cur, val) => <td className="p-3 tabular-nums"><button className="underline decoration-dotted" onClick={() => setDrill({ cat, partner, cur })}>{fmtNum(val)}</button></td>
  const drillRows = drill ? rows.filter((r) => r.category === drill.cat && r.currency === drill.cur && (!drill.partner || r.partner === drill.partner)) : []
  const flat = rep.rows.map((r) => ({ category: r.category, ...Object.fromEntries(partners.flatMap((p) => [[`${p}_USD`, r.byPartner[p].USD], [`${p}_SYP`, r.byPartner[p].SYP]])), totalUSD: r.total.USD, totalSYP: r.total.SYP }))
  return (
    <div>
      <PageHeader title="تقرير تكلفة الأرض"><button className="btn-ghost" onClick={() => exportRows({ filename: 'land_cost', sheet: 'Land_Cost', rows: flat,
        columns: [{ key: 'category', label: 'البند' }, ...partners.flatMap((p) => [{ key: `${p}_USD`, label: `${p} (USD)` }, { key: `${p}_SYP`, label: `${p} (SYP)` }]), { key: 'totalUSD', label: 'الإجمالي USD' }, { key: 'totalSYP', label: 'الإجمالي SYP' }] })}><Download size={16} />تصدير</button></PageHeader>
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><th className="p-3 text-right">البند</th>{partners.map((p) => <><th key={p + 'u'} className="p-3">{p} (USD)</th><th key={p + 's'} className="p-3">{p} (SYP)</th></>)}<th className="p-3">الإجمالي (USD)</th><th className="p-3">الإجمالي (SYP)</th></tr></thead>
        <tbody>{rep.rows.map((r) => <tr key={r.category} className="border-t"><td className="p-3 font-semibold">{r.category}</td>
          {partners.map((p) => <>{cell(r.category, p, 'USD', r.byPartner[p].USD)}{cell(r.category, p, 'SYP', r.byPartner[p].SYP)}</>)}
          {cell(r.category, null, 'USD', r.total.USD)}{cell(r.category, null, 'SYP', r.total.SYP)}</tr>)}
          <tr className="border-t bg-slate-50 font-bold"><td className="p-3">إجمالي الاستثمار في الأرض</td>{partners.map((p) => { const t = rep.rows.reduce((a, r) => ({ USD: a.USD + r.byPartner[p].USD, SYP: a.SYP + r.byPartner[p].SYP }), { USD: 0, SYP: 0 }); return <><td className="p-3">{fmtNum(t.USD)}</td><td className="p-3">{fmtNum(t.SYP)}</td></> })}<td className="p-3">{fmtNum(rep.total.USD)}</td><td className="p-3">{fmtNum(rep.total.SYP)}</td></tr></tbody></table></div>
      <p className="text-xs text-slate-500 mt-2">محسوب مباشرة من سجلات الأرض. لا يُجمع الدولار والليرة. اضغط أي رقم لعرض السجلات المكوِّنة له.</p>
      {drill && <Modal wide title={`${drill.cat} — ${drill.partner || 'الكل'} — ${drill.cur}`} onClose={() => setDrill(null)}>
        <table className="w-full text-sm"><thead><tr><th className="text-right p-2">المعرّف</th><th className="text-right p-2">الوصف</th><th className="p-2">المبلغ</th></tr></thead>
          <tbody>{drillRows.map((r) => <tr key={r.id} className="border-t"><td className="p-2">{r.code}</td><td className="p-2">{r.description}</td><td className="p-2 tabular-nums">{fmtNum(r.amount)}</td></tr>)}</tbody></table></Modal>}
    </div>
  )
}
