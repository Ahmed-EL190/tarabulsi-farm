import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { db, audit } from '../../services/db'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { LIST_LABELS, DEFAULT_LISTS } from '../../utils/defaults'
import { PageHeader, useToast } from '../../components/ui'

export default function Settings() {
  const lists = useLists(); const { role } = useAuth(); const toast = useToast(); const [key, setKey] = useState('partners'); const [v, setV] = useState('')
  const admin = can(role, 'admin'); const cur = lists[key]
  const persist = async (items, disabled) => { try { await setDoc(doc(db, 'settings', 'lists'), { [key]: { items, disabled } }, { merge: true }); await audit('update', 'settings', `lists.${key}`, cur.items, items); toast.show('تم الحفظ') } catch (e) { toast.show(e.message, 'err') } }
  const add = () => { const t = v.trim(); if (!t) return; if (cur.items.some((i) => i.trim().toLowerCase() === t.toLowerCase())) return toast.show('القيمة موجودة مسبقاً', 'err'); persist([...cur.items, t], cur.disabled); setV('') }
  const move = (i, d) => { const a = [...cur.items]; const j = i + d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]]; persist(a, cur.disabled) }
  const toggle = (it) => persist(cur.items, cur.disabled.includes(it) ? cur.disabled.filter((x) => x !== it) : [...cur.disabled, it])
  const rename = (i) => { const t = prompt('الاسم الجديد', cur.items[i]); if (!t || t.trim() === cur.items[i]) return; if (cur.items.includes(t.trim())) return toast.show('القيمة موجودة مسبقاً', 'err'); const a = [...cur.items]; a[i] = t.trim(); persist(a, cur.disabled) }
  return (
    <div>
      <PageHeader title="القوائم والإعدادات" />
      {!admin && <div className="card mb-3 text-sm">للمدير فقط التعديل. يمكنك الاطلاع.</div>}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card md:col-span-1 space-y-1">{Object.keys(DEFAULT_LISTS).map((k) => <button key={k} onClick={() => setKey(k)} className={`block w-full text-right px-3 py-1.5 rounded-lg text-sm ${key === k ? 'bg-brand-600 text-white' : 'hover:bg-slate-100'}`}>{LIST_LABELS[k]}</button>)}</div>
        <div className="card md:col-span-3"><h3 className="font-bold mb-3">{LIST_LABELS[key]}</h3>
          {admin && <div className="flex gap-2 mb-3"><input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="قيمة جديدة" /><button className="btn" onClick={add}><Plus size={16} />إضافة</button></div>}
          <ul>{cur.items.map((it, i) => <li key={it} className="flex items-center gap-2 py-1.5 border-b text-sm"><span className={`flex-1 ${cur.disabled.includes(it) ? 'line-through text-slate-400' : ''}`}>{it}</span>
            {admin && <><button onClick={() => move(i, -1)}><ArrowUp size={14} /></button><button onClick={() => move(i, 1)}><ArrowDown size={14} /></button><button className="text-xs underline" onClick={() => rename(i)}>تعديل</button><button className="text-xs underline" onClick={() => toggle(it)}>{cur.disabled.includes(it) ? 'تفعيل' : 'تعطيل'}</button></>}</li>)}</ul>
          <p className="text-xs text-slate-500 mt-3">التعطيل يخفي القيمة من القوائم الجديدة فقط؛ السجلات القديمة تحتفظ بقيمتها الأصلية.</p></div></div>
      {toast.node}
    </div>
  )
}
