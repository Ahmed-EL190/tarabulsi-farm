import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { PageHeader, Empty } from '../../components/ui'
import { exportRows } from '../../utils/exportExcel'

const OPS = { create: 'إنشاء', update: 'تعديل', import: 'استيراد' }
export default function AuditLog() {
  const [rows, setRows] = useState([]); const [err, setErr] = useState(''); const [f, setF] = useState({ op: '', col: '', q: '' }); const [open, setOpen] = useState(null); const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); getDocs(query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(500))).then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data(), when: d.data().at?.toDate?.().toISOString().replace('T', ' ').slice(0, 19) || '' })))).catch((e) => setErr(e.message)).finally(() => setLoading(false)) }
  useEffect(load, [])
  const cols = useMemo(() => [...new Set(rows.map((r) => r.col))], [rows])
  const shown = rows.filter((r) => (!f.op || r.op === f.op) && (!f.col || r.col === f.col) && (!f.q || JSON.stringify(r).includes(f.q)))
  return (
    <div>
      <PageHeader title="سجل التدقيق (آخر 500 عملية)"><button className="btn-ghost" onClick={load}>تحديث</button>
        <button className="btn-ghost" onClick={() => exportRows({ filename: 'audit_log', sheet: 'Audit', columns: [{ key: 'when', label: 'الوقت' }, { key: 'op', label: 'العملية' }, { key: 'col', label: 'المجموعة' }, { key: 'id', label: 'السجل' }, { key: 'by', label: 'المستخدم' }], rows: shown })}>تصدير</button></PageHeader>
      <div className="card mb-3 grid grid-cols-3 gap-3">
        <div><label className="label">العملية</label><select className="input" value={f.op} onChange={(e) => setF({ ...f, op: e.target.value })}><option value="">الكل</option>{Object.entries(OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">المجموعة</label><select className="input" value={f.col} onChange={(e) => setF({ ...f, col: e.target.value })}><option value="">الكل</option>{cols.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label">بحث</label><input className="input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div></div>
      {err && <div className="card text-red-600 text-sm mb-3">{err}</div>}
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['الوقت', 'العملية', 'المجموعة', 'السجل', 'المستخدم', ''].map((h) => <th key={h} className="p-3 text-right">{h}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={6}><Empty text="جارٍ التحميل…" /></td></tr> : shown.length === 0 ? <tr><td colSpan={6}><Empty /></td></tr> : shown.map((r) => (
          <>{<tr key={r.id} className="border-t"><td className="p-3 whitespace-nowrap">{r.when}</td><td className="p-3">{OPS[r.op] || r.op}</td><td className="p-3">{r.col}</td><td className="p-3 font-mono text-xs">{r.id}</td><td className="p-3 font-mono text-xs">{String(r.by || '').slice(0, 8)}</td><td className="p-3"><button className="underline text-xs" onClick={() => setOpen(open === r.id ? null : r.id)}>قبل/بعد</button></td></tr>}
          {open === r.id && <tr key={r.id + 'x'}><td colSpan={6} className="p-3 bg-slate-50"><div className="grid md:grid-cols-2 gap-3 text-xs"><div><b>قبل</b><pre className="whitespace-pre-wrap" dir="ltr">{JSON.stringify(r.before, null, 1)}</pre></div><div><b>بعد</b><pre className="whitespace-pre-wrap" dir="ltr">{JSON.stringify(r.after, null, 1)}</pre></div></div></td></tr>}</>))}</tbody></table></div>
    </div>
  )
}
