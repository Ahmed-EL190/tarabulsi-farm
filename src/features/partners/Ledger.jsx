import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { collection, doc, serverTimestamp } from 'firebase/firestore'
import { Download, Plus } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useAuth, can } from '../../app/AuthContext'
import { COL, db, writeBatch, audit } from '../../services/db'
import { auth } from '../../firebase/config'
import { ledgerBalances, repaymentExceedsLiability } from '../../utils/finance'
import { exportRows } from '../../utils/exportExcel'
import { Modal, Empty, PageHeader, fmtNum, useToast } from '../../components/ui'
import { Field } from '../../components/FormFields'

export default function Ledger() {
  const { rows } = useCollection(COL.ledger); const lists = useLists(); const { role } = useAuth(); const toast = useToast()
  const [partner, setPartner] = useState(''); const [open, setOpen] = useState(false)
  const form = useForm({ defaultValues: { type: 'سداد', fromCash: false } }); const v = form.watch()
  const all = useMemo(() => ledgerBalances(rows), [rows])
  const shown = all.filter((r) => !partner || r.partner === partner)
  const balanceOf = (p) => all.filter((r) => r.partner === p).slice(-1)[0]?.balance ?? 0
  const cols = [{ key: 'date', label: 'التاريخ' }, { key: 'partner', label: 'الشريك' }, { key: 'type', label: 'نوع الحركة' }, { key: 'description', label: 'البيان' }, { key: 'additionSYP', label: 'إضافة إلى المستحق (ل.س)' }, { key: 'repaymentSYP', label: 'السداد الفعلي (ل.س)' }, { key: 'balance', label: 'الرصيد المستحق (ل.س)' }, { key: 'notes', label: 'ملاحظات' }]

  const save = form.handleSubmit(async (x) => {
    try {
      const amt = Number(x.amount); if (!x.partner) throw new Error('اختر الشريك'); if (!(amt > 0)) throw new Error('المبلغ غير صالح')
      if (x.type === 'تعديل معتمد' && !x.notes) throw new Error('التعديل يتطلب تفسيراً في الملاحظات')
      const rec = { date: x.date || null, partner: x.partner, type: x.type, description: x.description || '', additionSYP: null, repaymentSYP: null, notes: x.notes || '', archived: false, createdBy: auth.currentUser?.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      if (x.type === 'سداد') { if (repaymentExceedsLiability(balanceOf(x.partner), amt)) throw new Error('السداد يتجاوز الرصيد المستحق — استخدم «تعديل معتمد» مع تفسير'); rec.repaymentSYP = amt }
      else if (x.type === 'تعديل معتمد' && x.adjustDir === 'خصم') rec.repaymentSYP = amt
      else rec.additionSYP = amt
      const batch = writeBatch(db); const lref = doc(collection(db, COL.ledger)); batch.set(lref, rec)
      if (x.type === 'سداد' && x.fromCash) { // linked cash movement, counted once in consolidated cash
        const mref = doc(collection(db, COL.milk))
        batch.set(mref, { date: x.date, type: 'مدفوعات', category: 'أخرى', description: `سداد مستحقات ${x.partner}`, paymentsSYP: amt, netSYP: -amt, linkedLedgerId: lref.id, entryKind: 'partnerRepayment', archived: false, createdBy: auth.currentUser?.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        batch.update(lref, { linkedMilkId: mref.id })
      }
      await batch.commit(); await audit('create', COL.ledger, lref.id, null, rec)
      toast.show('تم الحفظ'); setOpen(false)
    } catch (e) { toast.show(e.message, 'err') }
  })
  return (
    <div>
      <PageHeader title="سجل مستحقات الشركاء">
        <select className="input w-40" value={partner} onChange={(e) => setPartner(e.target.value)}><option value="">كل الشركاء</option>{lists.partners.items.map((p) => <option key={p}>{p}</option>)}</select>
        <button className="btn-ghost" onClick={() => exportRows({ filename: `partner_statement_${partner || 'all'}`, sheet: 'Statement', columns: cols, rows: shown })}><Download size={16} />كشف حساب</button>
        {can(role, 'write') && <button className="btn" onClick={() => { form.reset({ type: 'سداد', fromCash: false }); setOpen(true) }}><Plus size={16} />حركة جديدة</button>}
      </PageHeader>
      <div className="grid md:grid-cols-3 gap-3 mb-4">{lists.partners.items.map((p) => <div className="card" key={p}><div className="text-xs text-slate-500">المستحق للشريك</div><div className="font-bold">{p}</div><div className="text-xl">{fmtNum(balanceOf(p))} ل.س</div></div>)}</div>
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{cols.map((c) => <th key={c.key} className="p-3 text-right">{c.label}</th>)}</tr></thead>
        <tbody>{shown.length === 0 ? <tr><td colSpan={9}><Empty /></td></tr> : shown.map((r) => <tr key={r.id} className="border-t">{cols.map((c) => <td key={c.key} className="p-3 tabular-nums">{['additionSYP', 'repaymentSYP', 'balance'].includes(c.key) ? fmtNum(r[c.key]) : String(r[c.key] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <p className="text-xs text-slate-500 mt-2">الرصيد = الافتتاحي + الإضافات − السداد الفعلي. المبالغ بالدولار لا تتحول إلى ليرة دون سعر صرف وتاريخ صريحين.</p>
      {open && <Modal title="حركة مستحقات" onClose={() => setOpen(false)}><form onSubmit={save} className="grid md:grid-cols-2 gap-3">
        <Field f={{ name: 'partner', label: 'الشريك', type: 'select', required: true }} form={form} options={lists.partners.active} />
        <Field f={{ name: 'type', label: 'نوع الحركة', type: 'select' }} form={form} options={['رصيد افتتاحي', 'إضافة مستحق', 'سداد', 'تعديل معتمد']} />
        <Field f={{ name: 'date', label: 'التاريخ', type: 'date', required: v.type !== 'رصيد افتتاحي' }} form={form} />
        <Field f={{ name: 'amount', label: 'المبلغ (ل.س)', type: 'number', required: true }} form={form} />
        {v.type === 'تعديل معتمد' && <Field f={{ name: 'adjustDir', label: 'اتجاه التعديل', type: 'select' }} form={form} options={['زيادة', 'خصم']} />}
        <Field f={{ name: 'description', label: 'البيان', type: 'text' }} form={form} />
        <Field f={{ name: 'notes', label: 'ملاحظات', type: 'textarea' }} form={form} />
        {v.type === 'سداد' && <label className="md:col-span-2 text-sm flex gap-2 items-center"><input type="checkbox" {...form.register('fromCash')} />السداد من صندوق الحليب (يُسجَّل خروج نقد مرتبط تلقائياً)</label>}
        <div className="md:col-span-2 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button><button className="btn">حفظ</button></div></form></Modal>}
      {toast.node}
    </div>
  )
}
