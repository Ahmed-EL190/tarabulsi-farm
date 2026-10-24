import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { db, audit, create, archive, COL } from '../../services/db'
import { useLists } from '../../hooks/useLists'
import { useSettings } from '../../hooks/useSettings'
import { useCollection } from '../../hooks/useCollection'
import { useAuth, can } from '../../app/AuthContext'
import { LIST_LABELS, DEFAULT_LISTS } from '../../utils/defaults'
import { PageHeader, Confirm, Empty, fmtNum, useToast } from '../../components/ui'

function Lists({ admin, toast }) {
  const lists = useLists(); const [key, setKey] = useState('partners'); const [v, setV] = useState(''); const cur = lists[key]
  const persist = async (items, disabled) => { try { await setDoc(doc(db, 'settings', 'lists'), { [key]: { items, disabled } }, { merge: true }); await audit('update', 'settings', `lists.${key}`, cur.items, items); toast.show('تم الحفظ') } catch (e) { toast.show(e.message, 'err') } }
  const add = () => { const t = v.trim(); if (!t) return; if (cur.items.some((i) => i.trim().toLowerCase() === t.toLowerCase())) return toast.show('القيمة موجودة مسبقاً', 'err'); persist([...cur.items, t], cur.disabled); setV('') }
  const move = (i, d) => { const a = [...cur.items]; const j = i + d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]]; persist(a, cur.disabled) }
  const toggle = (it) => persist(cur.items, cur.disabled.includes(it) ? cur.disabled.filter((x) => x !== it) : [...cur.disabled, it])
  const rename = (i) => { const t = prompt('الاسم الجديد', cur.items[i]); if (!t || t.trim() === cur.items[i]) return; if (cur.items.includes(t.trim())) return toast.show('القيمة موجودة مسبقاً', 'err'); const a = [...cur.items]; a[i] = t.trim(); persist(a, cur.disabled) }
  return (
    <div className="grid md:grid-cols-4 gap-4">
      <div className="card md:col-span-1 space-y-1">{Object.keys(DEFAULT_LISTS).map((k) => <button key={k} onClick={() => setKey(k)} className={`block w-full text-right px-3 py-1.5 rounded-lg text-sm ${key === k ? 'bg-brand-600 text-white' : 'hover:bg-slate-100'}`}>{LIST_LABELS[k]}</button>)}</div>
      <div className="card md:col-span-3"><h3 className="font-bold mb-3">{LIST_LABELS[key]}</h3>
        {admin && <div className="flex gap-2 mb-3"><input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="قيمة جديدة" /><button className="btn" onClick={add}><Plus size={16} />إضافة</button></div>}
        <ul>{cur.items.map((it, i) => <li key={it} className="flex items-center gap-2 py-1.5 border-b text-sm"><span className={`flex-1 ${cur.disabled.includes(it) ? 'line-through text-slate-400' : ''}`}>{it}</span>
          {admin && <><button onClick={() => move(i, -1)}><ArrowUp size={14} /></button><button onClick={() => move(i, 1)}><ArrowDown size={14} /></button><button className="text-xs underline" onClick={() => rename(i)}>تعديل</button><button className="text-xs underline" onClick={() => toggle(it)}>{cur.disabled.includes(it) ? 'تفعيل' : 'تعطيل'}</button></>}</li>)}</ul>
        <p className="text-xs text-slate-500 mt-3">التعطيل يخفي القيمة من القوائم الجديدة فقط؛ السجلات القديمة تحتفظ بقيمتها. «تعديل» الاسم يغيّره في القوائم فقط ولا يغيّر السجلات القديمة، فالأفضل تعطيل القيمة القديمة وإضافة الجديدة.</p></div></div>)
}

function Opening({ admin, toast }) {
  const s = useSettings(); const [vals, setVals] = useState(null); const cash = vals || { SYP: s.openingCash.SYP ?? 0, USD: s.openingCash.USD ?? 0 }
  const save = async () => { try { const oc = { SYP: Number(cash.SYP) || 0, USD: Number(cash.USD) || 0 }; await setDoc(doc(db, 'settings', 'general'), { openingCash: oc }, { merge: true }); await audit('update', 'settings', 'general.openingCash', s.openingCash, oc); toast.show('تم الحفظ'); setVals(null) } catch (e) { toast.show(e.message, 'err') } }
  return (
    <div className="card max-w-lg space-y-3"><h3 className="font-bold">الرصيد الافتتاحي للصندوق</h3>
      <p className="text-xs text-slate-500">رصيد الصندوق الحالي = الرصيد الافتتاحي + كل المقبوضات − كل المدفوعات المسجلة. أدخل ما كان في الصندوق قبل أول سجل.</p>
      {['SYP', 'USD'].map((c) => <div key={c}><label className="label">الافتتاحي ({c})</label><input type="number" className="input" disabled={!admin} value={cash[c]} onChange={(e) => setVals({ ...cash, [c]: e.target.value })} /></div>)}
      {admin && <button className="btn" onClick={save}>حفظ</button>}</div>)
}

function Rates({ admin, toast }) {
  const { rows } = useCollection(COL.rates); const [f, setF] = useState({ date: new Date().toLocaleDateString('en-CA'), rate: '', note: '' }); const [del, setDel] = useState(null)
  const add = async () => { try { const r = Number(f.rate); if (!(r > 0)) throw new Error('السعر غير صالح'); if (!f.date) throw new Error('التاريخ مطلوب'); await create(COL.rates, { date: f.date, rate: r, note: f.note || '' }); setF({ ...f, rate: '', note: '' }); toast.show('تمت الإضافة') } catch (e) { toast.show(e.message, 'err') } }
  return (
    <div className="space-y-3"><div className="card"><h3 className="font-bold mb-1">أسعار الصرف (ليرة سورية لكل 1 دولار)</h3><p className="text-xs text-slate-500 mb-3">كل سعر له تاريخ ومصدر. لا يُستخدم تلقائياً لتغيير أي سجل تاريخي؛ يُستعمل فقط عند طلب تحويل صريح.</p>
      {admin && <div className="grid md:grid-cols-4 gap-2 items-end"><div><label className="label">التاريخ</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className="label">السعر</label><input type="number" className="input" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
        <div><label className="label">المصدر/ملاحظة</label><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div><button className="btn" onClick={add}>إضافة</button></div>}</div>
      <div className="card p-0"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">السعر</th><th className="p-3 text-right">المصدر</th><th /></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={4}><Empty /></td></tr> : rows.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{r.date}</td><td className="p-3">{fmtNum(r.rate)}</td><td className="p-3">{r.note}</td><td className="p-3">{admin && <button className="text-xs text-red-600" onClick={() => setDel(r)}>أرشفة</button>}</td></tr>)}</tbody></table></div>
      {del && <Confirm message="أرشفة هذا السعر؟" onYes={async () => { try { await archive(COL.rates, del.id, del); toast.show('تمت الأرشفة') } catch (e) { toast.show(e.message, 'err') } setDel(null) }} onNo={() => setDel(null)} />}</div>)
}

export default function Settings() {
  const { role } = useAuth(); const toast = useToast(); const admin = can(role, 'admin'); const [tab, setTab] = useState('lists')
  return (
    <div><PageHeader title="الإعدادات" />{!admin && <div className="card mb-3 text-sm">للمدير فقط التعديل. يمكنك الاطلاع.</div>}
      <div className="flex gap-2 mb-4">{[['lists', 'القوائم'], ['cash', 'رصيد الصندوق الافتتاحي'], ['rates', 'أسعار الصرف']].map(([k, l]) => <button key={k} className={tab === k ? 'btn' : 'btn-ghost'} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'lists' ? <Lists admin={admin} toast={toast} /> : tab === 'cash' ? <Opening admin={admin} toast={toast} /> : <Rates admin={admin} toast={toast} />}
      {toast.node}</div>)
}
