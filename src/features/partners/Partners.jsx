import { useState } from 'react'
import CrudPage from '../../components/CrudPage'
import Ledger from './Ledger'
import { COL } from '../../services/db'
import { numOrNull } from '../../utils/docs'

const expCfg = {
  title: 'مصاريف دفعها الشركاء (Partner-Depts)', collection: COL.partnerExpenses, exportName: 'partner_expenses', noCreate: true, searchKeys: ['type', 'notes', 'partner'],
  columns: [{ key: 'date', label: 'التاريخ' }, { key: 'partner', label: 'الشريك' }, { key: 'type', label: 'نوع الحركة/البيان' }, { key: 'amount', label: 'المبلغ', num: true }, { key: 'currency', label: 'العملة' },
    { key: 'reimbursement', label: 'حالة السداد' }, { key: 'milkRef', label: 'مرجع الصندوق' }, { key: 'notes', label: 'ملاحظات' }],
  filters: [{ key: 'partner', label: 'الشريك', listKey: 'partners' }, { key: 'currency', label: 'العملة', listKey: 'currencies' }, { key: 'reimbursement', label: 'السداد', options: ['غير مسدد', 'مسدد جزئياً', 'مسدد'] }],
  fields: [{ name: 'date', label: 'التاريخ (إن عُرف)', lockIf: (r) => !!r.milkRef, type: 'date' }, { name: 'partner', label: 'الشريك', lockIf: (r) => !!r.milkRef, type: 'select', listKey: 'partners', required: true }, { name: 'type', label: 'البيان', lockIf: (r) => !!r.milkRef, type: 'text', required: true },
    { name: 'amount', label: 'المبلغ', lockIf: (r) => !!r.milkRef, type: 'number', required: true }, { name: 'currency', label: 'العملة', lockIf: (r) => !!r.milkRef, type: 'select', listKey: 'currencies', required: true },
    { name: 'reimbursement', label: 'حالة سداد الشريك', type: 'select', options: ['غير مسدد', 'مسدد جزئياً', 'مسدد'] }, { name: 'notes', label: 'ملاحظات', type: 'textarea' }],
  editNote: (r) => (r.milkRef ? 'هذا المصروف مرتبط بسجل في الصندوق، لذلك يمكن تعديل حالة السداد والملاحظات فقط. لتعديل المبلغ أو الشريك عدّل سجل الصندوق نفسه.' : ''),
  prepare: (v, row) => (row?.milkRef
    ? { partner: row.partner, type: row.type, amount: row.amount, currency: row.currency, date: row.date ?? null, reimbursement: v.reimbursement || 'غير مسدد', notes: v.notes || '' }
    : { ...v, date: v.date || null, amount: numOrNull(v.amount), reimbursement: v.reimbursement || 'غير مسدد' }),
}
export default function Partners() {
  const [tab, setTab] = useState('ledger')
  return (
    <div>
      <div className="flex gap-2 mb-4">{[['ledger', 'سجل المستحقات'], ['exp', 'مصاريف الشركاء']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={tab === k ? 'btn' : 'btn-ghost'}>{l}</button>)}</div>
      {tab === 'ledger' ? <Ledger /> : <><p className="text-xs text-slate-500 mb-3">تُضاف مصاريف الشريك الجديدة من «الدخول اليومي» فتُسجَّل مرة واحدة وتُربط هنا تلقائياً دون أن تؤثر على رصيد الصندوق.</p><CrudPage cfg={expCfg} /></>}
    </div>
  )
}
