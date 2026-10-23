import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Download } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { COL } from '../../services/db'
import { addAnimal } from '../../services/cattle'
import { exportRows } from '../../utils/exportExcel'
import { Modal, Empty, PageHeader, fmtNum, useToast } from '../../components/ui'
import { Field } from '../../components/FormFields'

export const ANIMAL_FIELDS = (lists) => [
  { name: 'animalId', label: 'رقم الحيوان (Animal_ID)', type: 'text', required: true }, { name: 'name', label: 'الاسم/الرقم', type: 'text' },
  { name: 'category', label: 'الفئة', type: 'select', required: true, o: lists.animalCategories.active }, { name: 'status', label: 'الحالة', type: 'select', required: true, o: lists.animalStatuses.active },
  { name: 'purchaseDate', label: 'تاريخ الشراء', type: 'date' }, { name: 'purchasePrice', label: 'سعر الشراء', type: 'number' }, { name: 'currency', label: 'عملة الشراء', type: 'select', o: lists.currencies.active },
  { name: 'hasCalf', label: 'معها عجل؟', type: 'select', o: ['نعم', 'لا'] }, { name: 'baselineMilkL', label: 'إنتاج الحليب الأساسي (لتر/يوم)', type: 'number' },
  { name: 'motherId', label: 'الأم (Animal_ID)', type: 'text' }, { name: 'birthDate', label: 'تاريخ الولادة', type: 'date' }, { name: 'birthRaw', label: 'الولادة/العمر كما سُجل', type: 'text' },
  { name: 'source', label: 'المصدر/البائع', type: 'text' }, { name: 'health', label: 'الحالة الصحية', type: 'text' }, { name: 'notes', label: 'ملاحظات', type: 'textarea' }]

export default function Cattle() {
  const { rows, loading } = useCollection(COL.cattle); const lists = useLists(); const { role } = useAuth(); const toast = useToast()
  const [q, setQ] = useState(''); const [f, setF] = useState({}); const [open, setOpen] = useState(false)
  const form = useForm({ defaultValues: { status: 'نشط', category: 'بقرة', recordCash: true } })
  const fv = form.watch()
  const shown = useMemo(() => rows.filter((r) => (!q || `${r.animalId} ${r.name}`.toLowerCase().includes(q.toLowerCase())) && Object.entries(f).every(([k, v]) => !v || r[k] === v)), [rows, q, f])
  const counts = useMemo(() => rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a }, {}), [rows])
  const save = form.handleSubmit(async (v) => {
    try { const { recordCash, ...rest } = v; await addAnimal(rest, { recordCash: !!recordCash })
      toast.show(Number(v.purchasePrice) > 0 && recordCash ? 'تمت الإضافة وسُجّلت دفعة الشراء في الصندوق' : 'تمت الإضافة'); setOpen(false) } catch (e) { toast.show(e.message, 'err') } })
  const cols = [{ key: 'animalId', label: 'الرقم' }, { key: 'name', label: 'الاسم' }, { key: 'category', label: 'الفئة' }, { key: 'status', label: 'الحالة' }, { key: 'motherId', label: 'الأم' }, { key: 'purchaseDate', label: 'تاريخ الشراء' }, { key: 'purchasePrice', label: 'سعر الشراء' }, { key: 'currency', label: 'العملة' }, { key: 'baselineMilkL', label: 'لتر/يوم' }, { key: 'health', label: 'الصحة' }, { key: 'source', label: 'المصدر' }]
  return (
    <div>
      <PageHeader title="الأبقار والعجول">
        <button className="btn-ghost" onClick={() => exportRows({ filename: 'cattle', sheet: 'Cattle', columns: cols, rows: shown })}><Download size={16} />تصدير</button>
        {can(role, 'write') && <button className="btn" onClick={() => { form.reset({ status: 'نشط', category: 'بقرة', recordCash: true }); setOpen(true) }}><Plus size={16} />إضافة حيوان</button>}
      </PageHeader>
      <div className="flex gap-3 flex-wrap mb-3 text-sm">{Object.entries(counts).map(([k, v]) => <span key={k} className="card py-2">{k}: <b>{v}</b></span>)}</div>
      <div className="card mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="label">بحث بالاسم/الرقم</label><input className="input" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {[['category', 'الفئة', lists.animalCategories.items], ['status', 'الحالة', lists.animalStatuses.items]].map(([k, l, o]) => <div key={k}><label className="label">{l}</label><select className="input" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">الكل</option>{o.map((x) => <option key={x}>{x}</option>)}</select></div>)}
        <div><label className="label">الحالة الصحية</label><input className="input" value={f.health || ''} onChange={(e) => setF({ ...f, health: e.target.value })} /></div>
      </div>
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{cols.map((c) => <th key={c.key} className="p-3 text-right">{c.label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={11}><Empty text="جارٍ التحميل…" /></td></tr> : shown.length === 0 ? <tr><td colSpan={11}><Empty /></td></tr> : shown.map((r) => (
          <tr key={r.id} className="border-t hover:bg-slate-50">{cols.map((c) => <td key={c.key} className="p-3">{c.key === 'animalId' ? <Link className="text-brand-600 underline" to={`/cattle/${r.animalId}`}>{r.animalId}</Link> : c.key === 'purchasePrice' ? fmtNum(r[c.key]) : String(r[c.key] ?? '')}</td>)}</tr>))}</tbody></table></div>
      {open && <Modal wide title="إضافة حيوان" onClose={() => setOpen(false)}><form onSubmit={save} className="grid md:grid-cols-2 gap-3">
        {ANIMAL_FIELDS(lists).map((x) => <Field key={x.name} f={x} form={form} options={x.o} />)}
        {Number(fv.purchasePrice) > 0 && <label className="md:col-span-2 text-sm flex gap-2 items-start rounded-lg bg-amber-50 p-3"><input type="checkbox" className="mt-1" {...form.register('recordCash')} /><span>تسجيل دفعة نقدية مرتبطة بالشراء في الصندوق (مدفوعات / «شراء حيوان»).<br /><span className="text-xs text-slate-500">أوقف الخيار إن كنت قد أدخلت هذه الدفعة يدوياً في الصندوق حتى لا تُحتسب مرتين.</span></span></label>}
        <div className="md:col-span-2 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button><button className="btn">حفظ</button></div></form></Modal>}
      {toast.node}
    </div>
  )
}
