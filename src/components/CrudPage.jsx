import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Download, Pencil, Eye, Archive, Printer, Search } from 'lucide-react'
import { useCollection } from '../hooks/useCollection'
import { useLists } from '../hooks/useLists'
import { useAuth, can } from '../app/AuthContext'
import { create, update, archive } from '../services/db'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/config'
import { exportRows } from '../utils/exportExcel'
import { Field } from './FormFields'
import { Modal, Confirm, Empty, Pagination, PageHeader, TruncWarn, fmtNum, useToast } from './ui'

const PAGE = 25
/**
 * cfg: {title, collection, columns:[{key,label,num?,render?}], fields:[...], filters:[{key,label,listKey|options}],
 *       prepare?(values)->doc (throws Error to reject), defaults?, rowFilter?(row), searchKeys?, exportName, stats?(rows)->node}
 */
export default function CrudPage({ cfg }) {
  const lists = useLists(); const { role } = useAuth(); const toast = useToast()
  const [sp] = useSearchParams()
  const [range, setRange] = useState({ from: sp.get('from') || '', to: sp.get('to') || '' })
  const { rows, loading, error, truncated } = useCollection(cfg.collection, range)
  const [q, setQ] = useState(''); const [flt, setFlt] = useState(() => Object.fromEntries((cfg.filters || []).map((f) => [f.key, sp.get(f.key) || '']))); const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' }); const [edit, setEdit] = useState(null); const [view, setView] = useState(null); const [confirm, setConfirm] = useState(null)
  const writable = can(role, 'write')

  const base = useMemo(() => rows.filter((r) => (cfg.rowFilter ? cfg.rowFilter(r) : true)), [rows])
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    let out = base.filter((r) => (!t || (cfg.searchKeys || ['description']).some((k) => String(r[k] ?? '').toLowerCase().includes(t))) &&
      Object.entries(flt).every(([k, v]) => !v || String(r[k]) === v))
    out = [...out].sort((a, b) => { const x = a[sort.key] ?? '', y = b[sort.key] ?? ''; return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1) })
    return out
  }, [base, q, flt, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE)); const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE)

  const form = useForm({ defaultValues: cfg.defaults || {} })
  const values = form.watch()
  const open = (row) => { form.reset(row ? Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'attachment').map(([k, v]) => [k, v ?? ''])) : cfg.defaults || {}); setEdit(row || {}) }
  const save = form.handleSubmit(async (v) => {
    try {
      for (const f of cfg.fields) if (f.required && (!f.showIf || f.showIf(v)) && (v[f.name] === '' || v[f.name] == null)) throw new Error(`الحقل مطلوب: ${f.label}`)
      for (const f of cfg.fields.filter((x) => x.type === 'file')) {
        const file = v[f.name]?.[0]
        if (file) { const r = ref(storage, `attachments/${cfg.collection}/${Date.now()}_${file.name}`); await uploadBytes(r, file); v.attachmentUrl = await getDownloadURL(r) }
        delete v[f.name]
      }
      const doc = cfg.prepare ? cfg.prepare(v) : v
      if (edit?.id) await update(cfg.collection, edit.id, doc, edit); else await create(cfg.collection, doc)
      toast.show('تم الحفظ'); setEdit(null)
    } catch (e) { toast.show(e.message || 'فشل الحفظ', 'err') }
  })
  const doArchive = async () => { try { await archive(cfg.collection, confirm.id, confirm); toast.show('تمت الأرشفة') } catch (e) { toast.show(e.message, 'err') } setConfirm(null) }
  const optsFor = (f) => (f.listKey ? lists[f.listKey].active : f.options)

  return (
    <div>
      <PageHeader title={cfg.title}>
        <button className="btn-ghost" onClick={() => exportRows({ filename: cfg.exportName, sheet: cfg.title, columns: cfg.columns.map((c) => ({ key: c.key, label: c.label })), rows: filtered, note: JSON.stringify({ ...range, ...flt, q }) })}><Download size={16} />تصدير Excel</button>
        {writable && !cfg.noCreate && <button className="btn" onClick={() => open(null)}><Plus size={16} />إضافة</button>}
      </PageHeader>
      {cfg.stats && <div className="mb-4">{cfg.stats(filtered)}</div>}
      <div className="card mb-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="col-span-2 relative"><label className="label">بحث</label><Search size={14} className="absolute top-8 right-3 text-slate-400" /><input className="input pr-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></div>
        <div><label className="label">من</label><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label">إلى</label><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        {(cfg.filters || []).map((f) => (
          <div key={f.key}><label className="label">{f.label}</label><select className="input" value={flt[f.key] || ''} onChange={(e) => { setFlt({ ...flt, [f.key]: e.target.value }); setPage(1) }}><option value="">الكل</option>{(f.listKey ? lists[f.listKey].items : f.options).map((o) => <option key={o}>{o}</option>)}</select></div>
        ))}
      </div>
      <TruncWarn show={truncated} />
      {error && <div className="card text-red-600 text-sm mb-3">تعذر التحميل: {String(error.message || error)}</div>}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>
            {cfg.columns.map((c) => <th key={c.key} className="text-right p-3 whitespace-nowrap cursor-pointer" onClick={() => setSort({ key: c.key, dir: sort.key === c.key && sort.dir === 'desc' ? 'asc' : 'desc' })}>{c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>)}
            <th className="p-3">إجراءات</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={99}><Empty text="جارٍ التحميل…" /></td></tr> : pageRows.length === 0 ? <tr><td colSpan={99}><Empty /></td></tr> :
              pageRows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  {cfg.columns.map((c) => <td key={c.key} className={`p-3 ${c.num ? 'tabular-nums' : ''}`}>{c.render ? c.render(r) : c.num ? fmtNum(r[c.key]) : String(r[c.key] ?? '')}</td>)}
                  <td className="p-3 whitespace-nowrap flex gap-2">
                    <button title="عرض" onClick={() => setView(r)}><Eye size={16} /></button>
                    {writable && <button title="تعديل" onClick={() => open(r)}><Pencil size={16} /></button>}
                    {writable && <button title="أرشفة" onClick={() => setConfirm(r)}><Archive size={16} className="text-red-500" /></button>}
                  </td>
                </tr>))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} setPage={setPage} />
      </div>
      <p className="text-xs text-slate-500 mt-2">{filtered.length} سجل</p>

      {edit && (
        <Modal title={edit.id ? 'تعديل' : 'إضافة'} wide onClose={() => setEdit(null)}>
          <form onSubmit={save} className="grid md:grid-cols-2 gap-3">
            {cfg.fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => <Field key={f.name} f={f} form={form} options={optsFor(f)} />)}
            <div className="md:col-span-2 flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>إلغاء</button><button className="btn" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'جارٍ الحفظ…' : 'حفظ'}</button></div>
          </form>
        </Modal>)}
      {view && (
        <Modal title="تفاصيل السجل" onClose={() => setView(null)}>
          <dl className="grid grid-cols-3 gap-2 text-sm">{Object.entries(view).filter(([k]) => !['createdAt', 'updatedAt'].includes(k)).map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="col-span-2 break-words">{String(v ?? '')}</dd></div>)}</dl>
          <button className="btn-ghost mt-4" onClick={() => window.print()}><Printer size={16} />طباعة</button>
        </Modal>)}
      {confirm && <Confirm message="سيتم أرشفة السجل (لا يُحذف نهائياً). متابعة؟" onYes={doArchive} onNo={() => setConfirm(null)} />}
      {toast.node}
    </div>
  )
}
