import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { COL } from '../../services/db'
import { updateAnimal, recordEvent } from '../../services/cattle'
import { Modal, PageHeader, Empty, fmtNum, useToast } from '../../components/ui'
import { Field } from '../../components/FormFields'
import { ANIMAL_FIELDS } from './Cattle'

export default function CattleProfile() {
  const { id } = useParams(); const lists = useLists(); const { role } = useAuth(); const toast = useToast()
  const { rows } = useCollection(COL.cattle); const { rows: events } = useCollection(COL.cattleEvents)
  const a = rows.find((r) => r.animalId === id); const calves = rows.filter((r) => r.motherId === id && r.animalId !== id)
  const evs = useMemo(() => events.filter((e) => e.animalId === id), [events, id])
  const [mode, setMode] = useState(null); const form = useForm(); const v = form.watch()
  if (!a) return <Empty text="جارٍ التحميل أو الحيوان غير موجود…" />
  const writable = can(role, 'write')
  const saveEdit = form.handleSubmit(async (x) => { try { const { id: _i, createdAt, updatedAt, ...patch } = x; await updateAnimal(id, patch, a); toast.show('تم الحفظ'); setMode(null) } catch (e) { toast.show(e.message, 'err') } })
  const saveEvent = form.handleSubmit(async (x) => { try {
    if (!x.date) throw new Error('التاريخ مطلوب'); if (x.amount && !x.currency) throw new Error('اختر العملة')
    await recordEvent(a, { ...x, amount: x.amount === '' || x.amount == null ? null : Number(x.amount), cash: !!x.cash }); toast.show('تم تسجيل الحدث'); setMode(null) } catch (e) { toast.show(e.message, 'err') } })
  return (
    <div>
      <PageHeader title={`${a.animalId} — ${a.name || ''}`}>
        <Link to="/cattle" className="btn-ghost">رجوع</Link>
        {writable && <button className="btn-ghost" onClick={() => { form.reset({ ...Object.fromEntries(Object.entries(a).map(([k, x]) => [k, x ?? ''])) }); setMode('edit') }}>تعديل</button>}
        {writable && <button className="btn" onClick={() => { form.reset({ type: 'علاج', date: new Date().toISOString().slice(0, 10) }); setMode('event') }}>تسجيل حدث</button>}
      </PageHeader>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card"><h3 className="font-bold mb-2">البيانات</h3><dl className="grid grid-cols-3 gap-2 text-sm">
          {ANIMAL_FIELDS(lists).map((f) => <div className="contents" key={f.name}><dt className="text-slate-500">{f.label}</dt><dd className="col-span-2">{f.name === 'purchasePrice' ? fmtNum(a[f.name]) : String(a[f.name] ?? '')}</dd></div>)}</dl>
          {calves.length > 0 && <div className="mt-3 text-sm"><b>العجول:</b> {calves.map((c) => <Link key={c.id} className="text-brand-600 underline ml-2" to={`/cattle/${c.animalId}`}>{c.animalId} {c.name}</Link>)}</div>}
          {a.motherId && a.motherId !== a.animalId && <div className="mt-2 text-sm">الأم: <Link className="text-brand-600 underline" to={`/cattle/${a.motherId}`}>{a.motherId}</Link></div>}</div>
        <div className="card"><h3 className="font-bold mb-2">السجل التاريخي</h3>
          {evs.length === 0 ? <Empty text="لا أحداث مسجلة." /> : <table className="w-full text-sm"><tbody>{evs.map((e) => <tr key={e.id} className="border-t"><td className="p-2">{e.date}</td><td className="p-2">{e.type}</td><td className="p-2">{e.amount != null ? `${fmtNum(e.amount)} ${e.currency}` : ''}</td><td className="p-2">{e.notes}</td></tr>)}</tbody></table>}</div>
      </div>
      {mode === 'edit' && <Modal wide title="تعديل الحيوان" onClose={() => setMode(null)}><form onSubmit={saveEdit} className="grid md:grid-cols-2 gap-3">
        {ANIMAL_FIELDS(lists).filter((f) => f.name !== 'animalId').map((f) => <Field key={f.name} f={f} form={form} options={f.o} />)}<div className="md:col-span-2 flex justify-end"><button className="btn">حفظ</button></div></form></Modal>}
      {mode === 'event' && <Modal title="تسجيل حدث" onClose={() => setMode(null)}><form onSubmit={saveEvent} className="grid md:grid-cols-2 gap-3">
        <Field f={{ name: 'type', label: 'نوع الحدث', type: 'select' }} form={form} options={lists.eventTypes.active} /><Field f={{ name: 'date', label: 'التاريخ', type: 'date', required: true }} form={form} />
        {v.type === 'ولادة' && <><Field f={{ name: 'calfId', label: 'رقم المولود', type: 'text', required: true }} form={form} /><Field f={{ name: 'calfName', label: 'اسم المولود', type: 'text' }} form={form} /><Field f={{ name: 'calfCategory', label: 'فئة المولود', type: 'select' }} form={form} options={['عجل', 'عجلة']} /></>}
        {v.type === 'تغيير حالة' && <Field f={{ name: 'newStatus', label: 'الحالة الجديدة', type: 'select' }} form={form} options={lists.animalStatuses.active} />}
        {['شراء', 'بيع', 'علاج'].includes(v.type) && <><Field f={{ name: 'amount', label: 'المبلغ', type: 'number' }} form={form} /><Field f={{ name: 'currency', label: 'العملة', type: 'select' }} form={form} options={lists.currencies.active} />
          <label className="md:col-span-2 text-sm flex gap-2"><input type="checkbox" {...form.register('cash')} />سجّل حركة نقد مرتبطة في الصندوق</label></>}
        <Field f={{ name: 'notes', label: 'ملاحظات', type: 'textarea' }} form={form} /><div className="md:col-span-2 flex justify-end"><button className="btn">حفظ</button></div></form></Modal>}
      {toast.node}
    </div>
  )
}
