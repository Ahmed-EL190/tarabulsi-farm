import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { collection, doc, serverTimestamp } from 'firebase/firestore'
import { Download, Plus } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { COL, db, writeBatch, audit } from '../../services/db'
import { auth } from '../../firebase/config'
import { advanceBalances, validateAdvance, cashDirection, ADV_TYPES, signed } from '../../utils/advances'
import { ledgerBalances } from '../../utils/finance'
import { exportRows } from '../../utils/exportExcel'
import { Modal, Confirm, Empty, PageHeader, fmtNum, useToast } from '../../components/ui'
import { Field } from '../../components/FormFields'

const today = () => new Date().toLocaleDateString('en-CA')
export default function Advances() {
  const { rows, loading, truncated } = useCollection(COL.advances); const { rows: ledger } = useCollection(COL.ledger); const { rows: regWorkers } = useCollection(COL.workers)
  const lists = useLists(); const { role } = useAuth(); const toast = useToast(); const writable = can(role, 'write')
  const [f, setF] = useState({ personType: '', person: '', currency: '', type: '', from: '', to: '' }); const [open, setOpen] = useState(false); const [del, setDel] = useState(null); const [busy, setBusy] = useState(false)
  const form = useForm({ defaultValues: { personType: 'عامل', type: 'سلفة', currency: 'SYP', date: today(), fromCash: true } }); const v = form.watch()

  const balances = useMemo(() => advanceBalances(rows), [rows])
  const open_ = balances.filter((b) => Math.abs(b.balance) > 1e-9)
  const names = useMemo(() => [...new Set([...lists.workers.active, ...regWorkers.map((w) => w.name), ...rows.filter((r) => r.personType === 'عامل').map((r) => r.person)])], [rows, lists, regWorkers])
  const shown = rows.filter((r) => (!f.personType || r.personType === f.personType) && (!f.person || r.person.includes(f.person)) && (!f.currency || r.currency === f.currency) && (!f.type || r.type === f.type) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to))
  const totals = ['SYP', 'USD'].map((c) => ({ c, workers: open_.filter((b) => b.currency === c && b.personType === 'عامل').reduce((s, b) => s + b.balance, 0), partners: open_.filter((b) => b.currency === c && b.personType === 'شريك').reduce((s, b) => s + b.balance, 0) }))
  const ledgerBal = useMemo(() => Object.fromEntries(Object.entries(ledgerBalances(ledger).reduce((a, e) => ({ ...a, [e.partner]: e.balance }), {}))), [ledger])
  const partnerNet = balances.filter((b) => b.personType === 'شريك' && b.currency === 'SYP')

  const save = form.handleSubmit(async (x) => {
    setBusy(true)
    try {
      const person = String(x.person || '').trim(); const err = validateAdvance(rows, { ...x, person }); if (err) throw new Error(err)
      const amt = Number(x.amount); const meta = { archived: false, createdBy: auth.currentUser?.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      const batch = writeBatch(db); const aref = doc(collection(db, COL.advances))
      const rec = { date: x.date, personType: x.personType, person, type: x.type, amount: amt, currency: x.currency, notes: x.notes || '', withCash: false, ...meta }
      const dir = cashDirection(x.type)
      if (dir && x.fromCash) { // linked cash movement: counts in the cashbox once, but is NOT an expense (isAdvance)
        const mref = doc(collection(db, COL.milk)); rec.withCash = true; rec.linkedMilkId = mref.id
        batch.set(mref, { date: x.date, type: dir === 'out' ? 'مدفوعات' : 'مقبوضات أخرى', category: 'سلف', description: `${x.type} — ${person}`, [`${dir === 'out' ? 'payments' : 'receipts'}${x.currency}`]: amt, [`net${x.currency}`]: dir === 'out' ? -amt : amt, isAdvance: true, advanceId: aref.id, entryKind: 'advance', ...meta })
      }
      batch.set(aref, rec); await batch.commit(); await audit('create', COL.advances, aref.id, null, rec)
      toast.show('تم الحفظ'); setOpen(false)
    } catch (e) { toast.show(e.message, 'err') } finally { setBusy(false) }
  })
  const doArchive = async () => { // archive the entry and its linked cash row together so the books stay consistent
    try { const b = writeBatch(db); b.update(doc(db, COL.advances, del.id), { archived: true, updatedAt: serverTimestamp() }); if (del.linkedMilkId) b.update(doc(db, COL.milk, del.linkedMilkId), { archived: true, updatedAt: serverTimestamp() })
      await b.commit(); await audit('update', COL.advances, del.id, del, { archived: true }); toast.show('تمت الأرشفة') } catch (e) { toast.show(e.message, 'err') } setDel(null) }
  const cols = [{ key: 'date', label: 'التاريخ' }, { key: 'personType', label: 'النوع' }, { key: 'person', label: 'الاسم' }, { key: 'type', label: 'الحركة' }, { key: 'amount', label: 'المبلغ' }, { key: 'currency', label: 'العملة' }, { key: 'cash', label: 'من/إلى الصندوق' }, { key: 'notes', label: 'ملاحظات' }]
  const typeOpts = v.personType === 'شريك' ? ADV_TYPES.filter((t) => t !== 'خصم من الأجر') : ADV_TYPES

  return (
    <div className="space-y-4">
      <PageHeader title="السلف (العمال والشركاء)">
        <button className="btn-ghost" onClick={() => exportRows({ filename: `advances_${f.person || 'all'}`, sheet: 'Advances', columns: cols, rows: shown.map((r) => ({ ...r, cash: r.withCash ? 'نعم' : 'لا' })), note: JSON.stringify(f) })}><Download size={16} />كشف / تصدير</button>
        {writable && <button className="btn" onClick={() => { form.reset({ personType: 'عامل', type: 'سلفة', currency: 'SYP', date: today(), fromCash: true }); setOpen(true) }}><Plus size={16} />حركة سلفة</button>}
      </PageHeader>
      {truncated && <div className="card text-sm text-amber-800 bg-amber-50">عدد السجلات كبير، الأرصدة قد تكون ناقصة. تواصل لتفعيل التجميع من الخادم.</div>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{totals.flatMap((t) => [
        <div key={t.c + 'w'} className="card"><div className="text-xs text-slate-500">سلف العمال المستحقة ({t.c})</div><div className="text-xl font-bold">{fmtNum(t.workers)}</div></div>,
        <div key={t.c + 'p'} className="card"><div className="text-xs text-slate-500">سلف الشركاء المستحقة ({t.c})</div><div className="text-xl font-bold">{fmtNum(t.partners)}</div></div>])}</div>

      <div className="card"><h3 className="font-bold mb-2">الأرصدة المستحقة على كل شخص</h3>
        {open_.length === 0 ? <Empty text="لا توجد سلف مستحقة." /> : <table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['النوع', 'الاسم', 'العملة', 'إجمالي السلف', 'المسدَّد/المخصوم', 'المتبقي'].map((h) => <th key={h} className="p-2 text-right">{h}</th>)}</tr></thead>
          <tbody>{open_.map((b) => <tr key={b.personType + b.person + b.currency} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setF({ ...f, person: b.person, personType: b.personType })}><td className="p-2">{b.personType}</td><td className="p-2">{b.person}</td><td className="p-2">{b.currency}</td><td className="p-2 tabular-nums">{fmtNum(b.advanced)}</td><td className="p-2 tabular-nums">{fmtNum(b.repaid)}</td><td className="p-2 tabular-nums font-bold">{fmtNum(b.balance)}</td></tr>)}</tbody></table>}
        <p className="text-xs text-slate-500 mt-2">اضغط على اسم لتصفية الحركات. السلفة المصروفة من الصندوق تخصم نقداً لكنها ليست مصروفاً، وتظهر هنا ذمة حتى تُسدَّد.</p></div>

      {partnerNet.length > 0 && <div className="card"><h3 className="font-bold mb-2">صافي الحساب مع الشركاء (ل.س فقط)</h3>
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['الشريك', 'مستحق له على المزرعة', 'سلفه على المزرعة', 'الصافي'].map((h) => <th key={h} className="p-2 text-right">{h}</th>)}</tr></thead>
          <tbody>{partnerNet.map((b) => { const owed = ledgerBal[b.person] || 0; return <tr key={b.person} className="border-t"><td className="p-2">{b.person}</td><td className="p-2 tabular-nums">{fmtNum(owed)}</td><td className="p-2 tabular-nums">{fmtNum(b.balance)}</td><td className="p-2 tabular-nums font-bold">{fmtNum(owed - b.balance)}</td></tr> })}</tbody></table>
        <p className="text-xs text-slate-500 mt-2">الصافي = ما يستحقه الشريك − ما استلفه. معلومة للمقارنة فقط ولا تُسجَّل مقاصة تلقائياً.</p></div>}

      <div className="card grid grid-cols-2 md:grid-cols-6 gap-3">
        <div><label className="label">النوع</label><select className="input" value={f.personType} onChange={(e) => setF({ ...f, personType: e.target.value })}><option value="">الكل</option><option>عامل</option><option>شريك</option></select></div>
        <div><label className="label">الاسم</label><input className="input" value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} /></div>
        <div><label className="label">الحركة</label><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">الكل</option>{ADV_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label">العملة</label><select className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}><option value="">الكل</option><option>SYP</option><option>USD</option></select></div>
        <div><label className="label">من</label><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div><label className="label">إلى</label><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div></div>
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{cols.map((c) => <th key={c.key} className="p-3 text-right whitespace-nowrap">{c.label}</th>)}<th /></tr></thead>
        <tbody>{loading ? <tr><td colSpan={9}><Empty text="جارٍ التحميل…" /></td></tr> : shown.length === 0 ? <tr><td colSpan={9}><Empty /></td></tr> : shown.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{r.date}</td><td className="p-3">{r.personType}</td><td className="p-3">{r.person}</td>
          <td className="p-3">{r.type}</td><td className={`p-3 tabular-nums ${signed(r) < 0 ? 'text-green-700' : 'text-red-700'}`}>{signed(r) < 0 ? '−' : '+'}{fmtNum(r.amount)}</td><td className="p-3">{r.currency}</td><td className="p-3">{r.withCash ? 'نعم' : 'لا'}</td><td className="p-3">{r.notes}</td>
          <td className="p-3">{writable && <button className="text-xs text-red-600" onClick={() => setDel(r)}>أرشفة</button>}</td></tr>)}</tbody></table></div>

      {open && <Modal title="حركة سلفة" onClose={() => setOpen(false)}><form onSubmit={save} className="grid md:grid-cols-2 gap-3">
        <Field f={{ name: 'personType', label: 'النوع', type: 'select' }} form={form} options={['عامل', 'شريك']} />
        {v.personType === 'شريك' ? <Field f={{ name: 'person', label: 'الشريك', type: 'select', required: true }} form={form} options={lists.partners.active} />
          : <div><label className="label">اسم العامل *</label><input className="input" list="workers-list" {...form.register('person')} /><datalist id="workers-list">{names.map((n) => <option key={n} value={n} />)}</datalist></div>}
        <Field f={{ name: 'type', label: 'الحركة', type: 'select' }} form={form} options={typeOpts} />
        <Field f={{ name: 'date', label: 'التاريخ', type: 'date', required: true }} form={form} />
        <Field f={{ name: 'amount', label: 'المبلغ', type: 'number', required: true }} form={form} />
        <Field f={{ name: 'currency', label: 'العملة', type: 'select', required: true }} form={form} options={lists.currencies.active} />
        {(v.type === 'سلفة' || v.type === 'سداد') && <label className="md:col-span-2 text-sm flex gap-2"><input type="checkbox" {...form.register('fromCash')} />{v.type === 'سلفة' ? 'دُفعت السلفة من صندوق المزرعة (يخرج نقد)' : 'استُلم السداد نقداً في الصندوق (يدخل نقد)'}</label>}
        {v.type === 'خصم من الأجر' && <p className="md:col-span-2 text-xs text-slate-500">الخصم من الأجر يُنقص السلفة المستحقة دون أي حركة نقد.</p>}
        <Field f={{ name: 'notes', label: v.type?.startsWith('تعديل') ? 'سبب التعديل (مطلوب)' : 'ملاحظات', type: 'textarea' }} form={form} />
        <div className="md:col-span-2 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button><button className="btn" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button></div></form></Modal>}
      {del && <Confirm message={`أرشفة هذه الحركة${del.linkedMilkId ? ' وحركة الصندوق المرتبطة بها' : ''}؟ لا يُحذف شيء نهائياً.`} onYes={doArchive} onNo={() => setDel(null)} />}
      {toast.node}
    </div>
  )
}
