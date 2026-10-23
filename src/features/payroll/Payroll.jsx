import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { collection, doc, serverTimestamp } from 'firebase/firestore'
import { Download, Plus, Printer } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { COL, db, writeBatch, audit, create, update, archive } from '../../services/db'
import { auth } from '../../firebase/config'
import { calcPayroll, statusFor, remaining, validatePayment, payrollTotals, PAY_TYPES } from '../../utils/payroll'
import { balanceOf, advanceBalances } from '../../utils/advances'
import { exportRows } from '../../utils/exportExcel'
import { Modal, Confirm, Empty, PageHeader, fmtNum, useToast } from '../../components/ui'
import { Field } from '../../components/FormFields'

const today = () => new Date().toLocaleDateString('en-CA')
const meta = () => ({ archived: false, createdBy: auth.currentUser?.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const BADGE = { 'مدفوع': 'bg-green-100 text-green-700', 'مدفوع جزئياً': 'bg-amber-100 text-amber-700', 'مستحق': 'bg-red-100 text-red-700' }

export default function Payroll() {
  const { role } = useAuth(); const writable = can(role, 'write'); const toast = useToast(); const lists = useLists()
  const { rows: workers } = useCollection(COL.workers); const { rows: payroll } = useCollection(COL.payroll); const { rows: advRows } = useCollection(COL.advances)
  const [tab, setTab] = useState('sheet'); const [period, setPeriod] = useState(today().slice(0, 7)); const [calcFor, setCalcFor] = useState(null); const [payFor, setPayFor] = useState(null)
  const [cancel, setCancel] = useState(null); const [wForm, setWForm] = useState(null); const [stmtId, setStmtId] = useState(''); const [busy, setBusy] = useState(false)

  const activeWorkers = workers.filter((w) => w.status !== 'متوقف')
  const sheets = payroll.filter((p) => p.period === period)
  const list = useMemo(() => {
    const byId = Object.fromEntries(sheets.map((p) => [p.workerId, p]))
    const base = activeWorkers.map((w) => ({ worker: w, sheet: byId[w.id] }))
    const extra = sheets.filter((s) => !activeWorkers.some((w) => w.id === s.workerId)).map((s) => ({ worker: workers.find((w) => w.id === s.workerId) || { id: s.workerId, name: s.worker, currency: s.currency, payType: s.payType, rate: s.rate }, sheet: s }))
    return [...base, ...extra]
  }, [workers, payroll, period])
  const totals = payrollTotals(sheets)
  const advBal = (w) => balanceOf(advRows, 'عامل', w.name, w.currency)

  /* ---------- workers registry ---------- */
  const wf = useForm(); const openWorker = (w) => { wf.reset(w ? Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v ?? ''])) : { payType: 'شهري', currency: 'SYP', status: 'نشط', startDate: today() }); setWForm(w || {}) }
  const saveWorker = wf.handleSubmit(async (x) => { setBusy(true); try {
    const name = String(x.name || '').trim(); if (!name) throw new Error('الاسم مطلوب'); if (!(Number(x.rate) > 0)) throw new Error('قيمة الأجر مطلوبة')
    if (!wForm.id && workers.some((w) => w.name.trim() === name)) throw new Error('يوجد عامل بنفس الاسم')
    const doc_ = { name, job: x.job || '', payType: x.payType, rate: Number(x.rate), currency: x.currency, status: x.status || 'نشط', startDate: x.startDate || null, phone: x.phone || '', notes: x.notes || '', date: x.startDate || today() }
    if (wForm.id) await update(COL.workers, wForm.id, doc_, wForm); else await create(COL.workers, doc_)
    toast.show('تم الحفظ'); setWForm(null) } catch (e) { toast.show(e.message, 'err') } finally { setBusy(false) } })

  /* ---------- calculate a payroll sheet ---------- */
  const cf = useForm(); const cv = cf.watch()
  const openCalc = (w) => { cf.reset({ calcDate: today(), daysWorked: '', bonus: '', otherDeduction: '', otherDeductionReason: '', advanceDeduction: '', notes: '' }); setCalcFor(w) }
  const preview = calcFor ? calcPayroll({ payType: calcFor.payType, rate: calcFor.rate, currency: calcFor.currency, ...cv }, advBal(calcFor)) : null
  const saveCalc = cf.handleSubmit(async (x) => { setBusy(true); try {
    const w = calcFor; if (payroll.some((p) => p.workerId === w.id && p.period === period && !p.archived)) throw new Error('تم احتساب كشف هذا العامل لهذه الفترة مسبقاً')
    const r = calcPayroll({ payType: w.payType, rate: w.rate, currency: w.currency, ...x }, advBal(w)); if (r.error) throw new Error(r.error)
    const n = (v) => (v === '' || v == null ? 0 : Number(v)); const b = writeBatch(db); const pref = doc(collection(db, COL.payroll)); let aref = null
    if (n(x.advanceDeduction) > 0) { aref = doc(collection(db, COL.advances)); b.set(aref, { date: x.calcDate || today(), personType: 'عامل', person: w.name, type: 'خصم من الأجر', amount: n(x.advanceDeduction), currency: w.currency, notes: `خصم من راتب ${period}`, withCash: false, payrollId: pref.id, ...meta() }) }
    const sheet = { workerId: w.id, worker: w.name, period, date: `${period}-01`, calcDate: x.calcDate || today(), payType: w.payType, rate: w.rate, daysWorked: w.payType === 'يومي' ? n(x.daysWorked) : null, base: r.calc.base, bonus: n(x.bonus), otherDeduction: n(x.otherDeduction), otherDeductionReason: x.otherDeductionReason || '', advanceDeduction: n(x.advanceDeduction), net: r.calc.net, currency: w.currency, paid: 0, status: statusFor(r.calc.net, 0), payments: [], linkedAdvanceId: aref?.id || null, notes: x.notes || '', ...meta() }
    b.set(pref, sheet); await b.commit(); await audit('create', COL.payroll, pref.id, null, sheet); toast.show('تم احتساب الكشف'); setCalcFor(null) } catch (e) { toast.show(e.message, 'err') } finally { setBusy(false) } })

  /* ---------- pay salary ---------- */
  const pf = useForm(); const openPay = (s) => { pf.reset({ date: today(), amount: remaining(s), payer: 'صندوق المزرعة', method: 'نقدي' }); setPayFor(s) }
  const savePay = pf.handleSubmit(async (x) => { setBusy(true); try {
    const s = payFor; const err = validatePayment(s, x.amount); if (err) throw new Error(err); if (!x.date) throw new Error('التاريخ مطلوب')
    const amt = Number(x.amount); const cur = s.currency; const b = writeBatch(db); const mref = doc(collection(db, COL.milk)); const partner = x.payer !== 'صندوق المزرعة' ? x.payer : null; let peId = null
    const base = { date: x.date, type: 'مصروف حظيرة', category: 'أجور', description: `راتب ${s.worker} — ${s.period}`, method: x.method || null, payrollId: s.id, entryKind: 'payroll', fundingSource: partner, ...meta() }
    if (partner) { const pe = doc(collection(db, COL.partnerExpenses)); peId = pe.id // partner paid personally: expense for the farm, no cash movement
      b.set(mref, { ...base, partnerAmount: amt, partnerCurrency: cur }); b.set(pe, { date: x.date, partner, type: `راتب ${s.worker} — ${s.period}`, amount: amt, currency: cur, reimbursement: 'غير مسدد', milkRef: mref.id, notes: '', ...meta() }) }
    else b.set(mref, { ...base, [`payments${cur}`]: amt, [`net${cur}`]: -amt })
    const paid = (Number(s.paid) || 0) + amt
    b.update(doc(db, COL.payroll, s.id), { paid, status: statusFor(s.net, paid), payments: [...(s.payments || []), { date: x.date, amount: amt, milkId: mref.id, peId, payer: partner || 'صندوق المزرعة', method: x.method || '' }], updatedAt: serverTimestamp() })
    await b.commit(); await audit('update', COL.payroll, s.id, { paid: s.paid }, { paid }); toast.show('تم تسجيل الصرف'); setPayFor(null) } catch (e) { toast.show(e.message, 'err') } finally { setBusy(false) } })

  /* ---------- cancel sheet: archive everything linked ---------- */
  const doCancel = async () => { try { const s = cancel; const b = writeBatch(db); const t = { archived: true, updatedAt: serverTimestamp() }
    b.update(doc(db, COL.payroll, s.id), t); if (s.linkedAdvanceId) b.update(doc(db, COL.advances, s.linkedAdvanceId), t)
    ;(s.payments || []).forEach((p) => { if (p.milkId) b.update(doc(db, COL.milk, p.milkId), t); if (p.peId) b.update(doc(db, COL.partnerExpenses, p.peId), t) })
    await b.commit(); await audit('update', COL.payroll, s.id, s, { archived: true }); toast.show('أُلغي الكشف وما يرتبط به') } catch (e) { toast.show(e.message, 'err') } setCancel(null) }

  /* ---------- statement ---------- */
  const stmtWorker = workers.find((w) => w.id === stmtId); const stmtRows = payroll.filter((p) => p.workerId === stmtId && !p.archived).sort((a, b) => a.period.localeCompare(b.period))
  const stmtTot = payrollTotals(stmtRows); const stmtAdv = stmtWorker ? advanceBalances(advRows).filter((r) => r.personType === 'عامل' && r.person === stmtWorker.name) : []
  const stmtAdvEntries = stmtWorker ? advRows.filter((r) => r.personType === 'عامل' && r.person === stmtWorker.name).slice(0, 12) : []

  const T = ({ children }) => <th className="p-2 text-right whitespace-nowrap">{children}</th>
  return (
    <div className="space-y-4">
      <PageHeader title="العمال والمرتبات"><div className="flex gap-2">{[['sheet', 'كشف الشهر'], ['stmt', 'كشف عامل'], ['workers', 'سجل العمال']].map(([k, l]) => <button key={k} className={tab === k ? 'btn' : 'btn-ghost'} onClick={() => setTab(k)}>{l}</button>)}</div></PageHeader>

      {tab === 'sheet' && <>
        <div className="card flex flex-wrap items-end gap-3"><div><label className="label">الشهر</label><input type="month" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
          {Object.entries(totals).map(([c, t]) => <div key={c} className="text-sm"><b>{c}:</b> الصافي {fmtNum(t.net)} · المدفوع {fmtNum(t.paid)} · <span className="text-red-600 font-bold">المتبقي {fmtNum(t.remaining)}</span></div>)}
          <button className="btn-ghost mr-auto" onClick={() => exportRows({ filename: `payroll_${period}`, sheet: period, columns: [{ key: 'worker', label: 'العامل' }, { key: 'currency', label: 'العملة' }, { key: 'base', label: 'الأساسي' }, { key: 'bonus', label: 'مكافآت' }, { key: 'otherDeduction', label: 'خصومات' }, { key: 'advanceDeduction', label: 'خصم سلف' }, { key: 'net', label: 'الصافي' }, { key: 'paid', label: 'المدفوع' }, { key: 'status', label: 'الحالة' }], rows: sheets })}><Download size={16} />تصدير</button></div>
        <div className="card p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><T>العامل</T><T>الأجر</T><T>الأساسي</T><T>مكافآت</T><T>خصومات</T><T>خصم سلف</T><T>الصافي</T><T>المدفوع</T><T>المتبقي</T><T>الحالة</T><T>إجراءات</T></tr></thead>
          <tbody>{list.length === 0 ? <tr><td colSpan={11}><Empty text="أضف العمال أولاً من تبويب «سجل العمال»." /></td></tr> : list.map(({ worker: w, sheet: s }) => <tr key={w.id} className="border-t">
            <td className="p-2 font-semibold">{w.name}<div className="text-[11px] text-slate-500">{w.job}</div></td><td className="p-2 text-xs">{w.payType}: {fmtNum(w.rate)} {w.currency}</td>
            {s ? <><td className="p-2 tabular-nums">{fmtNum(s.base)}</td><td className="p-2 tabular-nums">{fmtNum(s.bonus)}</td><td className="p-2 tabular-nums" title={s.otherDeductionReason}>{fmtNum(s.otherDeduction)}</td><td className="p-2 tabular-nums">{fmtNum(s.advanceDeduction)}</td><td className="p-2 tabular-nums font-bold">{fmtNum(s.net)}</td><td className="p-2 tabular-nums">{fmtNum(s.paid)}</td><td className="p-2 tabular-nums">{fmtNum(remaining(s))}</td><td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs ${BADGE[s.status]}`}>{s.status}</span></td>
              <td className="p-2 whitespace-nowrap space-x-2 space-x-reverse">{writable && remaining(s) > 0 && <button className="text-brand-600 underline" onClick={() => openPay(s)}>صرف</button>}{writable && <button className="text-red-600 text-xs" onClick={() => setCancel(s)}>إلغاء الكشف</button>}</td></>
              : <><td colSpan={8} className="p-2 text-slate-400 text-xs">لم يُحتسب كشف هذا الشهر · سلفة مستحقة: {fmtNum(advBal(w))} {w.currency}</td><td className="p-2">{writable && <button className="btn py-1" onClick={() => openCalc(w)}>احتساب</button>}</td><td /></>}</tr>)}</tbody></table></div>
        <p className="text-xs text-slate-500">الكشف المحسوب يُنقص السلف المستحقة تلقائياً (بحركة «خصم من الأجر» في صفحة السلف دون نقد). الصرف يخرج من الصندوق كمصروف «أجور» أو يُسجَّل كمصروف دفعه شريك. لا تسجّل نفس المرتب مرة ثانية من «الدخول اليومي».</p></>}

      {tab === 'stmt' && <>
        <div className="card flex flex-wrap items-end gap-3"><div><label className="label">العامل</label><select className="input" value={stmtId} onChange={(e) => setStmtId(e.target.value)}><option value="">— اختر —</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          {stmtWorker && <><button className="btn-ghost" onClick={() => window.print()}><Printer size={16} />طباعة</button><button className="btn-ghost" onClick={() => exportRows({ filename: `statement_${stmtWorker.name}`, sheet: 'كشف', columns: [{ key: 'period', label: 'الشهر' }, { key: 'base', label: 'الأساسي' }, { key: 'bonus', label: 'مكافآت' }, { key: 'otherDeduction', label: 'خصومات' }, { key: 'advanceDeduction', label: 'خصم سلف' }, { key: 'net', label: 'الصافي' }, { key: 'paid', label: 'المدفوع' }, { key: 'status', label: 'الحالة' }], rows: stmtRows })}><Download size={16} />تصدير</button></>}</div>
        {!stmtWorker ? <Empty text="اختر عاملاً لعرض كشفه." /> : <div className="card space-y-3"><h2 className="font-bold text-lg">كشف حساب: {stmtWorker.name} <span className="text-sm font-normal text-slate-500">({stmtWorker.job || '—'} · {stmtWorker.payType} {fmtNum(stmtWorker.rate)} {stmtWorker.currency})</span></h2>
          <table className="w-full text-sm"><thead className="bg-slate-50"><tr><T>الشهر</T><T>الأساسي</T><T>مكافآت</T><T>خصومات</T><T>خصم سلف</T><T>الصافي</T><T>المدفوع</T><T>المتبقي</T><T>الحالة</T></tr></thead>
            <tbody>{stmtRows.length === 0 ? <tr><td colSpan={9}><Empty text="لا كشوف بعد." /></td></tr> : stmtRows.map((s) => <tr key={s.id} className="border-t"><td className="p-2">{s.period}</td><td className="p-2 tabular-nums">{fmtNum(s.base)}</td><td className="p-2 tabular-nums">{fmtNum(s.bonus)}</td><td className="p-2 tabular-nums">{fmtNum(s.otherDeduction)}</td><td className="p-2 tabular-nums">{fmtNum(s.advanceDeduction)}</td><td className="p-2 tabular-nums font-bold">{fmtNum(s.net)}</td><td className="p-2 tabular-nums">{fmtNum(s.paid)}</td><td className="p-2 tabular-nums">{fmtNum(remaining(s))}</td><td className="p-2">{s.status}</td></tr>)}
              {Object.entries(stmtTot).map(([c, t]) => <tr key={c} className="border-t bg-slate-50 font-bold"><td className="p-2">الإجمالي {c}</td><td className="p-2">{fmtNum(t.base)}</td><td className="p-2">{fmtNum(t.bonus)}</td><td className="p-2">{fmtNum(t.otherDeduction)}</td><td className="p-2">{fmtNum(t.advanceDeduction)}</td><td className="p-2">{fmtNum(t.net)}</td><td className="p-2">{fmtNum(t.paid)}</td><td className="p-2">{fmtNum(t.remaining)}</td><td /></tr>)}</tbody></table>
          <div><h3 className="font-bold mb-1">السلف</h3>{stmtAdv.length === 0 ? <p className="text-sm text-slate-500">لا سلف مسجلة.</p> : stmtAdv.map((a) => <div key={a.currency} className="text-sm">{a.currency}: إجمالي السلف {fmtNum(a.advanced)} · المسدَّد/المخصوم {fmtNum(a.repaid)} · <b>المتبقي على العامل {fmtNum(a.balance)}</b></div>)}
            {stmtAdvEntries.length > 0 && <table className="w-full text-xs mt-2"><tbody>{stmtAdvEntries.map((a) => <tr key={a.id} className="border-t"><td className="p-1">{a.date}</td><td className="p-1">{a.type}</td><td className="p-1 tabular-nums">{fmtNum(a.amount)} {a.currency}</td><td className="p-1">{a.notes}</td></tr>)}</tbody></table>}</div></div>}</>}

      {tab === 'workers' && <>
        <div className="flex justify-end">{writable && <button className="btn" onClick={() => openWorker(null)}><Plus size={16} />إضافة عامل</button>}</div>
        <div className="card p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><T>الاسم</T><T>العمل</T><T>نوع الأجر</T><T>الأجر</T><T>العملة</T><T>الحالة</T><T>تاريخ البدء</T><T>سلفة مستحقة</T><T /></tr></thead>
          <tbody>{workers.length === 0 ? <tr><td colSpan={9}><Empty text="لا عمال مسجلون." /></td></tr> : workers.map((w) => <tr key={w.id} className="border-t"><td className="p-2 font-semibold">{w.name}</td><td className="p-2">{w.job}</td><td className="p-2">{w.payType}</td><td className="p-2 tabular-nums">{fmtNum(w.rate)}</td><td className="p-2">{w.currency}</td><td className="p-2">{w.status}</td><td className="p-2">{w.startDate}</td><td className="p-2 tabular-nums">{fmtNum(advBal(w))}</td>
            <td className="p-2 whitespace-nowrap">{writable && <><button className="underline text-xs ml-2" onClick={() => openWorker(w)}>تعديل</button><button className="underline text-xs text-red-600" onClick={() => setCancel({ worker_: w })}>أرشفة</button></>}</td></tr>)}</tbody></table></div></>}

      {wForm && <Modal title={wForm.id ? 'تعديل عامل' : 'إضافة عامل'} onClose={() => setWForm(null)}><form onSubmit={saveWorker} className="grid md:grid-cols-2 gap-3">
        <div><label className="label">الاسم * {wForm.id && <span className="text-slate-400">(لا يُغيَّر لارتباطه بالسلف)</span>}</label><input className="input" disabled={!!wForm.id} {...wf.register('name')} /></div>
        <Field f={{ name: 'job', label: 'العمل/الوظيفة', type: 'text' }} form={wf} /><Field f={{ name: 'payType', label: 'نوع الأجر', type: 'select' }} form={wf} options={PAY_TYPES} />
        <Field f={{ name: 'rate', label: 'الأجر (شهري أو يومي)', type: 'number', required: true }} form={wf} /><Field f={{ name: 'currency', label: 'العملة', type: 'select' }} form={wf} options={lists.currencies.active} />
        <Field f={{ name: 'status', label: 'الحالة', type: 'select' }} form={wf} options={['نشط', 'متوقف']} /><Field f={{ name: 'startDate', label: 'تاريخ البدء', type: 'date' }} form={wf} />
        <Field f={{ name: 'phone', label: 'الهاتف', type: 'text' }} form={wf} /><Field f={{ name: 'notes', label: 'ملاحظات', type: 'textarea' }} form={wf} />
        <div className="md:col-span-2 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setWForm(null)}>إلغاء</button><button className="btn" disabled={busy}>حفظ</button></div></form></Modal>}

      {calcFor && <Modal title={`احتساب مرتب ${calcFor.name} — ${period}`} onClose={() => setCalcFor(null)}><form onSubmit={saveCalc} className="grid md:grid-cols-2 gap-3">
        <div className="md:col-span-2 text-sm bg-slate-50 rounded-lg p-2">{calcFor.payType}: {fmtNum(calcFor.rate)} {calcFor.currency} · السلفة المستحقة على العامل: <b>{fmtNum(advBal(calcFor))} {calcFor.currency}</b></div>
        {calcFor.payType === 'يومي' && <Field f={{ name: 'daysWorked', label: 'عدد أيام العمل', type: 'number', required: true }} form={cf} />}
        <Field f={{ name: 'bonus', label: 'مكافآت / ساعات إضافية', type: 'number' }} form={cf} />
        <Field f={{ name: 'otherDeduction', label: 'خصومات أخرى (غياب، غرامة…)', type: 'number' }} form={cf} /><Field f={{ name: 'otherDeductionReason', label: 'سبب الخصم', type: 'text' }} form={cf} />
        <div><Field f={{ name: 'advanceDeduction', label: 'خصم من السلف المستحقة', type: 'number' }} form={cf} />
          {advBal(calcFor) > 0 && <button type="button" className="text-xs underline mt-1" onClick={() => { const g = (calcFor.payType === 'يومي' ? Number(calcFor.rate) * (Number(cv.daysWorked) || 0) : Number(calcFor.rate)) + (Number(cv.bonus) || 0) - (Number(cv.otherDeduction) || 0); cf.setValue('advanceDeduction', Math.max(0, Math.min(advBal(calcFor), g))) }}>خصم أقصى مبلغ ممكن</button>}</div>
        <Field f={{ name: 'calcDate', label: 'تاريخ الاحتساب', type: 'date' }} form={cf} /><Field f={{ name: 'notes', label: 'ملاحظات', type: 'textarea' }} form={cf} />
        <div className={`md:col-span-2 rounded-lg p-3 text-sm ${preview?.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50'}`}>{preview?.error ? preview.error : <>الأساسي {fmtNum(preview.calc.base)} + مكافآت − خصومات = <b>الصافي المستحق {fmtNum(preview.calc.net)} {calcFor.currency}</b></>}</div>
        <div className="md:col-span-2 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setCalcFor(null)}>إلغاء</button><button className="btn" disabled={busy || !!preview?.error}>{busy ? 'جارٍ الحفظ…' : 'حفظ الكشف'}</button></div></form></Modal>}

      {payFor && <Modal title={`صرف مرتب ${payFor.worker} — ${payFor.period}`} onClose={() => setPayFor(null)}><form onSubmit={savePay} className="grid md:grid-cols-2 gap-3">
        <div className="md:col-span-2 text-sm bg-slate-50 rounded-lg p-2">الصافي {fmtNum(payFor.net)} · المدفوع {fmtNum(payFor.paid)} · <b>المتبقي {fmtNum(remaining(payFor))} {payFor.currency}</b></div>
        <Field f={{ name: 'date', label: 'تاريخ الصرف', type: 'date', required: true }} form={pf} /><Field f={{ name: 'amount', label: `المبلغ (${payFor.currency})`, type: 'number', required: true }} form={pf} />
        <Field f={{ name: 'payer', label: 'من دفع؟', type: 'select' }} form={pf} options={['صندوق المزرعة', ...lists.partners.active]} /><Field f={{ name: 'method', label: 'طريقة الدفع', type: 'select' }} form={pf} options={lists.paymentMethods.active} />
        <p className="md:col-span-2 text-xs text-slate-500">من الصندوق: يخرج نقد ويُسجَّل مصروف أجور. من شريك: يُسجَّل مصروفاً على المزرعة دون خصم من الصندوق، ويظهر في مصاريف الشركاء.</p>
        <div className="md:col-span-2 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setPayFor(null)}>إلغاء</button><button className="btn" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'تأكيد الصرف'}</button></div></form></Modal>}

      {cancel && (cancel.worker_ ? <Confirm message={`أرشفة العامل ${cancel.worker_.name}؟ تبقى كشوفه وسجلاته.`} onYes={async () => { try { await archive(COL.workers, cancel.worker_.id, cancel.worker_); toast.show('تمت الأرشفة') } catch (e) { toast.show(e.message, 'err') } setCancel(null) }} onNo={() => setCancel(null)} />
        : <Confirm message="إلغاء الكشف سيؤرشف أيضاً خصم السلف المرتبط ودفعات الصرف المرتبطة بالصندوق. متابعة؟" onYes={doCancel} onNo={() => setCancel(null)} />)}
      {toast.node}
    </div>
  )
}
