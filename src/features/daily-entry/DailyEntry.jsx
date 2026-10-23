import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Droplets, Banknote, ShoppingCart, Wheat, Pill, Users, Wrench, UserCheck, Layers, PiggyBank, Landmark, Undo2, HandCoins, FileText } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { COL } from '../../services/db'
import { saveMilkDoc, archiveMilk, newSubmissionId } from '../../services/milkLinks'
import { localToday } from '../../utils/money'
import { ENTRY_KINDS, buildMilkDoc, entryFingerprint } from '../../utils/entryMapping'
import { cashSummary, milkProduction } from '../../utils/finance'
import { recordEvent } from '../../services/cattle'
import { Field } from '../../components/FormFields'
import { Confirm, PageHeader, fmtNum, useToast } from '../../components/ui'
import CrudPage from '../../components/CrudPage'
import { landCfg } from '../land/configs'
import Ledger from '../partners/Ledger'

const TILES = [['production', Droplets], ['sale', ShoppingCart], ['receipt', Banknote], ['payment', HandCoins], ['feed', Wheat], ['medicine', Pill], ['wages', Users], ['utilities', Wrench],
  ['partnerExpense', UserCheck], ['other', Layers], ['cattle', PiggyBank], ['cattleEvent', FileText], ['land', Landmark], ['repayment', Undo2]]
const LABEL = { ...Object.fromEntries(Object.entries(ENTRY_KINDS).map(([k, v]) => [k, v.label])), cattle: 'شراء/بيع حيوان', cattleEvent: 'ولادة / نفوق / تغيير حالة', land: 'الأرض والاستثمار', repayment: 'سداد مستحقات شريك' }
const today = localToday

function MilkForm({ kind, date, existing, onSaved, toast }) {
  const lists = useLists(); const form = useForm({ defaultValues: { currency: 'SYP' } }); const v = form.watch(); const [dup, setDup] = useState(null); const [busy, setBusy] = useState(false)
  const needsAmount = !['production', 'sale'].includes(kind); const gross = kind === 'sale' ? Math.max(0, (Number(v.liters) || 0) * (Number(v.pricePerL) || 0) - (Number(v.discount) || 0)) : 0
  const subId = useRef(null) // one stable id per submission: a retry after a network failure overwrites the same document instead of creating a duplicate
  const doSave = async (doc_) => {
    setBusy(true)
    try {
      subId.current ||= newSubmissionId()
      await saveMilkDoc({ id: null, newId: subId.current, data: { ...doc_, fp: entryFingerprint(doc_) } }) // also keeps the partnerExpenses link atomic
      subId.current = null
      toast.show('تم الحفظ'); form.reset({ currency: v.currency }); onSaved()
    } catch (e) { toast.show(e.message || 'فشل الحفظ — يمكنك الضغط على حفظ مرة أخرى بأمان', 'err') } finally { setBusy(false) }
  }
  const submit = form.handleSubmit(async (x) => {
    try { const d = buildMilkDoc(kind, { ...x, date }); if (existing.some((e) => entryFingerprint(e) === entryFingerprint(d))) setDup(d); else await doSave(d) } catch (e) { toast.show(e.message, 'err') }
  })
  const F = (f, o) => <Field f={f} form={form} options={o} />
  return (
    <form onSubmit={submit} className="card grid md:grid-cols-2 gap-3">
      {kind === 'production' && <>{F({ name: 'morningL', label: 'حليب صباحاً (لتر)', type: 'number' })}{F({ name: 'eveningL', label: 'حليب مساءً (لتر)', type: 'number' })}
        <p className="md:col-span-2 text-sm">الإجمالي: <b>{fmtNum((Number(v.morningL) || 0) + (Number(v.eveningL) || 0))}</b> لتر — الإنتاج ليس إيراداً ولا يُسجَّل كمقبوضات.</p></>}
      {kind === 'sale' && <>{F({ name: 'liters', label: 'الكمية المباعة (لتر)', type: 'number', required: true })}{F({ name: 'pricePerL', label: 'سعر اللتر', type: 'number', required: true })}{F({ name: 'discount', label: 'خصم', type: 'number' })}
        {F({ name: 'currency', label: 'العملة', type: 'select' }, lists.currencies.active)}{F({ name: 'collected', label: 'المبلغ المحصَّل', type: 'number', hint: `الصافي: ${fmtNum(gross)} — اتركه فارغاً للتحصيل الكامل، أو أدخل أقل لتسجيل بيع آجل` })}
        {F({ name: 'description', label: 'المشتري/البيان', type: 'text' })}</>}
      {needsAmount && <>{F({ name: 'amount', label: 'المبلغ', type: 'number', required: true })}{F({ name: 'currency', label: 'العملة', type: 'select' }, lists.currencies.active)}
        {F({ name: 'category', label: 'التصنيف', type: 'select' }, lists.expenseCategories.active)}{F({ name: 'description', label: 'البيان', type: 'text' })}</>}
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
    await recordEvent(animal, { ...x, date, amount: x.amount, cash: !!x.cash }); toast.show('تم الحفظ'); form.reset({ type: x.type }) } catch (e) { toast.show(e.message, 'err') } })
  const types = kind === 'cattle' ? ['بيع', 'علاج'] : ['ولادة', 'نفوق', 'تغيير حالة', 'تلقيح']
  return (
    <form onSubmit={save} className="card grid md:grid-cols-2 gap-3">
      <Field f={{ name: 'animalId', label: 'الحيوان', type: 'select', required: true }} form={form} options={rows.map((r) => r.animalId)} />
      <Field f={{ name: 'type', label: 'الحدث', type: 'select' }} form={form} options={types} />
      {v.type === 'ولادة' && <><Field f={{ name: 'calfId', label: 'رقم المولود', type: 'text', required: true }} form={form} /><Field f={{ name: 'calfName', label: 'اسم المولود', type: 'text' }} form={form} /></>}
      {v.type === 'تغيير حالة' && <Field f={{ name: 'newStatus', label: 'الحالة الجديدة', type: 'select' }} form={form} options={lists.animalStatuses.active} />}
      {['بيع', 'علاج'].includes(v.type) && <><Field f={{ name: 'amount', label: 'المبلغ', type: 'number' }} form={form} /><Field f={{ name: 'currency', label: 'العملة', type: 'select' }} form={form} options={lists.currencies.active} />
        <label className="md:col-span-2 text-sm flex gap-2"><input type="checkbox" {...form.register('cash')} />سجّل حركة نقد مرتبطة</label></>}
      <p className="md:col-span-2 text-xs text-slate-500">لشراء حيوان جديد استخدم صفحة «الأبقار والعجول ← إضافة حيوان».</p>
      <Field f={{ name: 'notes', label: 'ملاحظات', type: 'textarea' }} form={form} />
      <div className="md:col-span-2 flex justify-end"><button className="btn">حفظ</button></div>
    </form>
  )
}

export default function DailyEntry() {
  const { role } = useAuth(); const toast = useToast(); const [date, setDate] = useState(today()); const [kind, setKind] = useState('production'); const [del, setDel] = useState(null)
  const range = useMemo(() => ({ from: date, to: date }), [date]); const { rows } = useCollection(COL.milk, range)
  const cash = cashSummary(rows); const prod = milkProduction(rows); const partner = rows.filter((r) => r.partnerAmount != null)
  if (!can(role, 'write')) return <div className="card">صلاحيتك للعرض فقط.</div>
  return (
    <div className="space-y-4">
      <PageHeader title="إضافة إدخال يومي"><div><label className="label">التاريخ</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div></PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{TILES.map(([k, Icon]) => (
        <button key={k} onClick={() => setKind(k)} className={`card flex flex-col items-center gap-2 py-4 text-sm ${kind === k ? 'ring-2 ring-brand-500 bg-brand-50' : ''}`}><Icon size={22} className="text-brand-600" />{LABEL[k]}</button>))}</div>
      <h2 className="font-bold">{LABEL[kind]}</h2>
      {kind in ENTRY_KINDS ? <MilkForm key={kind} kind={kind} date={date} existing={rows} onSaved={() => {}} toast={toast} />
        : kind === 'cattle' || kind === 'cattleEvent' ? <CattleQuick key={kind} kind={kind} date={date} toast={toast} />
        : kind === 'land' ? <CrudPage cfg={landCfg} /> : <Ledger />}
      <div className="card"><h3 className="font-bold mb-2">ملخص يوم {date}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div>إنتاج: <b>{fmtNum(prod.total)}</b> لتر ({fmtNum(prod.morning)} ص / {fmtNum(prod.evening)} م)</div>
          <div>مقبوضات ل.س: <b>{fmtNum(cash.SYP.receipts)}</b></div><div>مدفوعات ل.س: <b>{fmtNum(cash.SYP.payments)}</b></div><div>مقبوضات USD: <b>{fmtNum(cash.USD.receipts)}</b></div><div>مدفوعات USD: <b>{fmtNum(cash.USD.payments)}</b></div></div>
        {partner.length > 0 && <p className="text-xs text-slate-500 mt-2">مصاريف مموّلة من الشركاء (خارج الصندوق): {partner.map((p) => `${fmtNum(p.partnerAmount)} ${p.partnerCurrency}`).join('، ')}</p>}
        <table className="w-full text-sm mt-3"><tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="p-2">{r.type}</td><td className="p-2">{r.category}</td><td className="p-2">{r.description}</td>
          <td className="p-2 tabular-nums">{[r.morningL != null || r.eveningL != null ? `${fmtNum(r.liters)} ل` : '', r.receiptsSYP != null ? `+${fmtNum(r.receiptsSYP)} ل.س` : '', r.paymentsSYP != null ? `-${fmtNum(r.paymentsSYP)} ل.س` : '', r.receiptsUSD != null ? `+${fmtNum(r.receiptsUSD)}$` : '', r.paymentsUSD != null ? `-${fmtNum(r.paymentsUSD)}$` : '', r.partnerAmount != null ? `شريك ${fmtNum(r.partnerAmount)} ${r.partnerCurrency}` : ''].filter(Boolean).join(' ')}</td>
          <td className="p-2"><button className="text-red-600 text-xs" onClick={() => setDel(r)}>أرشفة</button></td></tr>)}</tbody></table></div>
      {del && <Confirm message="أرشفة هذا السجل؟ (لا يُحذف نهائياً — صحّحه من الصندوق أو أعد إدخاله)" onYes={async () => { try { await archiveMilk(del.id, del); toast.show('تمت الأرشفة') } catch (e) { toast.show(e.message, 'err') } setDel(null) }} onNo={() => setDel(null)} />}
      {toast.node}
    </div>
  )
}
