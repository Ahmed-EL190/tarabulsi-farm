import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { collection, doc, serverTimestamp } from 'firebase/firestore'
import { Droplets, Banknote, ShoppingCart, Wheat, Pill, Users, Wrench, UserCheck, Layers, PiggyBank, Landmark, Undo2, HandCoins, FileText } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { COL, db, writeBatch, audit, archive, create } from '../../services/db'
import { auth } from '../../firebase/config'
import { ENTRY_KINDS, buildMilkDoc, entryFingerprint } from '../../utils/entryMapping'
import { cashSummary, milkProduction } from '../../utils/finance'
import { recordEvent, addAnimal } from '../../services/cattle'
import { Field } from '../../components/FormFields'
import { Confirm, PageHeader, fmtNum, useToast } from '../../components/ui'
import CrudPage from '../../components/CrudPage'
import { landCfg } from '../land/configs'
import Ledger from '../partners/Ledger'

const TILES = [['production', Droplets], ['sale', ShoppingCart], ['receipt', Banknote], ['payment', HandCoins], ['feed', Wheat], ['medicine', Pill], ['wages', Users], ['utilities', Wrench],
  ['partnerExpense', UserCheck], ['other', Layers], ['newAnimal', PiggyBank], ['cattle', PiggyBank], ['cattleEvent', FileText], ['land', Landmark], ['repayment', Undo2]]
const LABEL = { ...Object.fromEntries(Object.entries(ENTRY_KINDS).map(([k, v]) => [k, v.label])), newAnimal: 'شراء حيوان جديد', cattle: 'بيع / علاج حيوان', cattleEvent: 'ولادة / نفوق / تغيير حالة', land: 'الأرض والاستثمار', repayment: 'سداد مستحقات شريك' }
const today = () => new Date().toLocaleDateString('en-CA')

function MilkForm({ kind, date, existing, onSaved, toast }) {
  const lists = useLists(); const form = useForm({ defaultValues: { currency: 'SYP' } }); const v = form.watch(); const [dup, setDup] = useState(null); const [busy, setBusy] = useState(false)
  const key = `draft:${kind}:${date}`; const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => { try { const d = localStorage.getItem(key); if (d) { form.reset(JSON.parse(d)); setHasDraft(true) } else setHasDraft(false) } catch {} }, [key])
  useEffect(() => { const sub = form.watch((val) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }); return () => sub.unsubscribe() }, [key])
  const needsAmount = !['production', 'sale'].includes(kind); const gross = kind === 'sale' ? Math.max(0, (Number(v.liters) || 0) * (Number(v.pricePerL) || 0) - (Number(v.discount) || 0)) : 0
  const doSave = async (doc_) => {
    setBusy(true)
    try {
      const meta = { archived: false, createdBy: auth.currentUser?.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      const b = writeBatch(db); const mref = doc(collection(db, COL.milk)); const payload = { ...doc_, ...meta, fp: entryFingerprint(doc_) }
      if (doc_.type === 'مصروف حظيرة' && doc_.category === 'دواء وعلاج') payload.expAmount = null
      b.set(mref, payload)
      if (kind === 'partnerExpense') { // single source = milk doc; partnerExpenses row links to it (never counted twice)
        b.set(doc(collection(db, COL.partnerExpenses)), { date: doc_.date, partner: doc_.fundingSource, type: doc_.description || doc_.category, amount: doc_.partnerAmount, currency: doc_.partnerCurrency, reimbursement: 'غير مسدد', milkRef: mref.id, notes: doc_.notes, ...meta })
      }
      await b.commit(); await audit('create', COL.milk, mref.id, null, doc_)
      toast.show('تم الحفظ'); form.reset({ currency: v.currency }); setTimeout(() => { try { localStorage.removeItem(key) } catch {} setHasDraft(false) }, 0); onSaved()
    } catch (e) { toast.show(e.message || 'فشل الحفظ', 'err') } finally { setBusy(false) }
  }
  const submit = form.handleSubmit(async (x) => {
    try { const d = buildMilkDoc(kind, { ...x, date }); if (existing.some((e) => e.fp === entryFingerprint(d))) setDup(d); else await doSave(d) } catch (e) { toast.show(e.message, 'err') }
  })
  const F = (f, o) => <Field f={f} form={form} options={o} />
  return (
    <form onSubmit={submit} className="card grid md:grid-cols-2 gap-3">
      {hasDraft && <p className="md:col-span-2 text-xs text-amber-700">تم استرجاع مسودة غير محفوظة لهذا النوع واليوم. <button type="button" className="underline" onClick={() => { try { localStorage.removeItem(key) } catch {} form.reset({ currency: 'SYP' }); setHasDraft(false) }}>تجاهل المسودة</button></p>}
      {kind === 'production' && <>{F({ name: 'morningL', label: 'حليب صباحاً (لتر)', type: 'number' })}{F({ name: 'eveningL', label: 'حليب مساءً (لتر)', type: 'number' })}
        <p className="md:col-span-2 text-sm">الإجمالي: <b>{fmtNum((Number(v.morningL) || 0) + (Number(v.eveningL) || 0))}</b> لتر — الإنتاج ليس إيراداً ولا يُسجَّل كمقبوضات.</p></>}
      {kind === 'sale' && <>{F({ name: 'liters', label: 'الكمية المباعة (لتر)', type: 'number', required: true })}{F({ name: 'pricePerL', label: 'سعر اللتر', type: 'number', required: true })}{F({ name: 'discount', label: 'خصم', type: 'number' })}
        {F({ name: 'currency', label: 'العملة', type: 'select' }, lists.currencies.active)}{F({ name: 'collected', label: 'المبلغ المحصَّل', type: 'number', hint: `الصافي: ${fmtNum(gross)} — اتركه فارغاً للتحصيل الكامل، أو أدخل أقل لتسجيل بيع آجل` })}
        {F({ name: 'customer', label: 'العميل/المشتري', type: 'text' })}{F({ name: 'description', label: 'بيان', type: 'text' })}</>}
      {needsAmount && <>{F({ name: 'amount', label: 'المبلغ', type: 'number', required: true })}{F({ name: 'currency', label: 'العملة', type: 'select' }, lists.currencies.active)}
        {F({ name: 'category', label: 'التصنيف', type: 'select' }, lists.expenseCategories.active)}{F({ name: 'description', label: 'البيان', type: 'text' })}</>}
      {kind === 'receipt' && F({ name: 'settlesCustomer', label: 'تسديد دين آجل للعميل (اختياري)', type: 'text', hint: 'اكتب اسم العميل نفسه ليُخصم من المتبقي عليه' })}
      {kind === 'partnerExpense' && F({ name: 'fundingSource', label: 'الشريك الذي دفع', type: 'select', required: true }, lists.partners.active)}
      {kind !== 'production' && F({ name: 'method', label: 'طريقة الدفع/القبض', type: 'select' }, lists.paymentMethods.active)}
      {F({ name: 'notes', label: 'ملاحظات', type: 'textarea' })}
      {kind === 'partnerExpense' && <p className="md:col-span-2 text-xs text-amber-700">مصروف الشريك يُسجَّل كمصروف على المزرعة ولا يخصم من رصيد الصندوق.</p>}
      <div className="md:col-span-2 flex justify-end"><button className="btn" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button></div>
      {dup && <Confirm message="يوجد سجل مطابق لهذا اليوم. هل تريد حفظه مرة أخرى؟" onYes={() => { const d = dup; setDup(null); doSave(d) }} onNo={() => setDup(null)} />}
    </form>
  )
}

function CattleQuick({ kind, date, toast }) {
  const lists = useLists(); const { rows } = useCollection(COL.cattle); const form = useForm({ defaultValues: { type: kind === 'cattle' ? 'بيع' : 'ولادة' } }); const v = form.watch()
  const save = form.handleSubmit(async (x) => { try {
    const animal = rows.find((r) => r.animalId === x.animalId); if (!animal) throw new Error('اختر الحيوان')
    await recordEvent(animal, { ...x, date, amount: x.amount ? Number(x.amount) : null, cash: !!x.cash }); toast.show('تم الحفظ'); form.reset({ type: x.type }) } catch (e) { toast.show(e.message, 'err') } })
  const types = kind === 'cattle' ? ['بيع', 'علاج'] : ['ولادة', 'نفوق', 'تغيير حالة', 'تلقيح']
  return (
    <form onSubmit={save} className="card grid md:grid-cols-2 gap-3">
      <Field f={{ name: 'animalId', label: 'الحيوان', type: 'select', required: true }} form={form} options={rows.map((r) => r.animalId)} />
      <Field f={{ name: 'type', label: 'الحدث', type: 'select' }} form={form} options={types} />
      {v.type === 'ولادة' && <><Field f={{ name: 'calfId', label: 'رقم المولود', type: 'text', required: true }} form={form} /><Field f={{ name: 'calfName', label: 'اسم المولود', type: 'text' }} form={form} /></>}
      {v.type === 'تغيير حالة' && <Field f={{ name: 'newStatus', label: 'الحالة الجديدة', type: 'select' }} form={form} options={lists.animalStatuses.active} />}
      {['بيع', 'علاج'].includes(v.type) && <><Field f={{ name: 'amount', label: 'المبلغ', type: 'number' }} form={form} /><Field f={{ name: 'currency', label: 'العملة', type: 'select' }} form={form} options={lists.currencies.active} />
        <label className="md:col-span-2 text-sm flex gap-2"><input type="checkbox" {...form.register('cash')} />سجّل حركة نقد مرتبطة</label></>}
            <Field f={{ name: 'notes', label: 'ملاحظات', type: 'textarea' }} form={form} />
      <div className="md:col-span-2 flex justify-end"><button className="btn">حفظ</button></div>
    </form>
  )
}

function NewAnimal({ date, toast }) {
  const lists = useLists(); const form = useForm({ defaultValues: { category: 'بقرة', status: 'نشط', currency: 'SYP', cash: true } }); const [busy, setBusy] = useState(false)
  const save = form.handleSubmit(async (x) => { setBusy(true); try {
    const price = x.purchasePrice === '' ? null : Number(x.purchasePrice); if (price !== null && (price < 0 || !x.currency)) throw new Error('السعر أو العملة غير صالحين')
    const id = await addAnimal({ animalId: x.animalId, name: x.name || '', category: x.category, status: x.status, purchaseDate: date, purchasePrice: price, currency: price !== null ? x.currency : null, source: x.source || '', notes: x.notes || '', hasCalf: 'لا' })
    if (x.cash && price > 0) await create(COL.milk, { date, type: 'مدفوعات', category: 'شراء حيوان', description: `شراء ${id} ${x.name || ''}`.trim(), [`payments${x.currency}`]: price, [`net${x.currency}`]: -price, animalId: id, entryKind: 'cattleCash' })
    toast.show('تمت الإضافة'); form.reset({ category: 'بقرة', status: 'نشط', currency: x.currency, cash: true }) } catch (e) { toast.show(e.message, 'err') } finally { setBusy(false) } })
  const F = (f, o) => <Field f={f} form={form} options={o} />
  return (<form onSubmit={save} className="card grid md:grid-cols-2 gap-3">
    {F({ name: 'animalId', label: 'رقم الحيوان (فريد)', type: 'text', required: true })}{F({ name: 'name', label: 'الاسم', type: 'text' })}
    {F({ name: 'category', label: 'الفئة', type: 'select' }, lists.animalCategories.active)}{F({ name: 'source', label: 'المصدر/البائع', type: 'text' })}
    {F({ name: 'purchasePrice', label: 'سعر الشراء', type: 'number' })}{F({ name: 'currency', label: 'العملة', type: 'select' }, lists.currencies.active)}
    <label className="md:col-span-2 text-sm flex gap-2"><input type="checkbox" {...form.register('cash')} />سجّل دفعة نقدية مرتبطة من الصندوق</label>
    {F({ name: 'notes', label: 'ملاحظات', type: 'textarea' })}<div className="md:col-span-2 flex justify-end"><button className="btn" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button></div></form>)
}

export default function DailyEntry() {
  const { role } = useAuth(); const toast = useToast(); const [date, setDate] = useState(today()); const [kind, setKind] = useState('production'); const [del, setDel] = useState(null)
  const range = useMemo(() => ({ from: date, to: date }), [date]); const { rows } = useCollection(COL.milk, range)
  const cash = cashSummary(rows); const prod = milkProduction(rows); const partner = rows.filter((r) => r.partnerAmount != null)
  if (!can(role, 'write')) return <div className="card">صلاحيتك للعرض فقط.</div>
  return (
    <div className="space-y-4">
      <PageHeader title="إضافة إدخال يومي"><div><label className="label">التاريخ</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div></PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">{TILES.map(([k, Icon]) => (
        <button key={k} onClick={() => setKind(k)} className={`card flex flex-col items-center gap-2 py-4 text-sm ${kind === k ? 'ring-2 ring-brand-500 bg-brand-50' : ''}`}><Icon size={22} className="text-brand-600" />{LABEL[k]}</button>))}</div>
      <h2 className="font-bold">{LABEL[kind]}</h2>
      {kind in ENTRY_KINDS ? <MilkForm key={kind} kind={kind} date={date} existing={rows} onSaved={() => {}} toast={toast} />
        : kind === 'newAnimal' ? <NewAnimal key={kind} date={date} toast={toast} />
        : kind === 'cattle' || kind === 'cattleEvent' ? <CattleQuick key={kind} kind={kind} date={date} toast={toast} />
        : kind === 'land' ? <CrudPage cfg={landCfg} /> : <Ledger />}
      <div className="card"><h3 className="font-bold mb-2">ملخص يوم {date}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div>إنتاج: <b>{fmtNum(prod.total)}</b> لتر ({fmtNum(prod.morning)} ص / {fmtNum(prod.evening)} م)</div>
          <div>مقبوضات ل.س: <b>{fmtNum(cash.SYP.receipts)}</b></div><div>مدفوعات ل.س: <b>{fmtNum(cash.SYP.payments)}</b></div><div>مقبوضات USD: <b>{fmtNum(cash.USD.receipts)}</b></div><div>مدفوعات USD: <b>{fmtNum(cash.USD.payments)}</b></div></div>
        {partner.length > 0 && <p className="text-xs text-slate-500 mt-2">مصاريف مموّلة من الشركاء (خارج الصندوق): {partner.map((p) => `${fmtNum(p.partnerAmount)} ${p.partnerCurrency}`).join('، ')}</p>}
        <table className="w-full text-sm mt-3"><tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="p-2">{r.type}</td><td className="p-2">{r.category}</td><td className="p-2">{r.description}</td>
          <td className="p-2 tabular-nums">{[r.morningL != null || r.eveningL != null ? `${fmtNum(r.liters)} ل` : '', r.receiptsSYP != null ? `+${fmtNum(r.receiptsSYP)} ل.س` : '', r.paymentsSYP != null ? `-${fmtNum(r.paymentsSYP)} ل.س` : '', r.receiptsUSD != null ? `+${fmtNum(r.receiptsUSD)}$` : '', r.paymentsUSD != null ? `-${fmtNum(r.paymentsUSD)}$` : '', r.partnerAmount != null ? `شريك ${fmtNum(r.partnerAmount)} ${r.partnerCurrency}` : ''].filter(Boolean).join(' ')}</td>
          <td className="p-2"><button className="text-red-600 text-xs" onClick={() => setDel(r)}>أرشفة</button></td></tr>)}</tbody></table></div>
      {del && <Confirm message="أرشفة هذا السجل؟ (لا يُحذف نهائياً — صحّحه من الصندوق أو أعد إدخاله)" onYes={async () => { try { await archive(COL.milk, del.id, del); toast.show('تمت الأرشفة') } catch (e) { toast.show(e.message, 'err') } setDel(null) }} onNo={() => setDel(null)} />}
      {toast.node}
    </div>
  )
}
