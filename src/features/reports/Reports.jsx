import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { COL } from '../../services/db'
import { cashSummary, expensesByCategory, ledgerBalances, landCostReport, totalLiters } from '../../utils/finance'
import { exportRows } from '../../utils/exportExcel'
import { Empty, PageHeader, fmtNum } from '../../components/ui'
import { advanceBalances } from '../../utils/advances'
import { remaining } from '../../utils/payroll'

const group = (rows, keyFn, init, add) => { const m = {}; rows.forEach((r) => { const k = keyFn(r); if (k == null) return; m[k] ??= init(); add(m[k], r) }); return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ key: k, ...v })) }
const n = (v) => Number(v) || 0

export default function Reports() {
  const today = new Date().toLocaleDateString('en-CA'); const [from, setFrom] = useState(today.slice(0, 8) + '01'); const [to, setTo] = useState(today); const [rid, setRid] = useState('daily')
  const range = useMemo(() => ({ from, to }), [from, to]); const lists = useLists()
  const { rows: tx } = useCollection(COL.milk, range); const { rows: cattle } = useCollection(COL.cattle); const { rows: land } = useCollection(COL.land)
  const { rows: allTx } = useCollection(COL.milk)
  const { rows: advRows } = useCollection(COL.advances)
  const { rows: payRows } = useCollection(COL.payroll)
  const { rows: ledger } = useCollection(COL.ledger); const { rows: pexp } = useCollection(COL.partnerExpenses); const { rows: events } = useCollection(COL.cattleEvents)

  const REPORTS = useMemo(() => ({
    daily: { title: 'التقرير التشغيلي اليومي', cols: [['date', 'التاريخ'], ['liters', 'إنتاج (ل)'], ['rSYP', 'مقبوضات ل.س'], ['pSYP', 'مدفوعات ل.س'], ['rUSD', 'مقبوضات USD'], ['pUSD', 'مدفوعات USD'], ['partner', 'مصاريف شركاء (خارج الصندوق)']],
      rows: () => group(tx, (r) => r.date, () => ({ liters: 0, rSYP: 0, pSYP: 0, rUSD: 0, pUSD: 0, partner: 0 }), (a, r) => { a.liters += r.type === 'حليب أولي' ? totalLiters(r) : 0; a.rSYP += n(r.receiptsSYP); a.pSYP += n(r.paymentsSYP); a.rUSD += n(r.receiptsUSD); a.pUSD += n(r.paymentsUSD); a.partner += n(r.partnerAmount) }).map((x) => ({ date: x.key, ...x })) },
    monthMilk: { title: 'إنتاج الحليب الشهري', cols: [['date', 'الشهر'], ['morning', 'صباحاً'], ['evening', 'مساءً'], ['total', 'الإجمالي (ل)']],
      rows: () => group(tx.filter((r) => r.morningL != null || r.eveningL != null), (r) => r.date.slice(0, 7), () => ({ morning: 0, evening: 0, total: 0 }), (a, r) => { a.morning += n(r.morningL); a.evening += n(r.eveningL); a.total += n(r.morningL) + n(r.eveningL) }).map((x) => ({ date: x.key, ...x })) },
    sales: { title: 'المبيعات والتحصيل', cols: [['date', 'التاريخ'], ['liters', 'لتر'], ['pricePerL', 'السعر'], ['receiptsSYP', 'محصَّل ل.س'], ['receiptsUSD', 'محصَّل USD'], ['outstanding', 'آجل/متبقي'], ['description', 'البيان']], rows: () => tx.filter((r) => r.type === 'مبيعات حليب') },
    expenses: { title: 'المصروفات حسب التصنيف', cols: [['category', 'التصنيف'], ['SYP', 'ل.س'], ['USD', 'USD']], rows: () => Object.entries(expensesByCategory(tx)).map(([category, v]) => ({ category, ...v })) },
    byFunding: { title: 'المصروفات حسب مصدر التمويل', cols: [['source', 'المصدر'], ['SYP', 'ل.س'], ['USD', 'USD']],
      rows: () => group(tx.filter((r) => !r.isAdvance && (['مصروف حظيرة', 'مدفوعات'].includes(r.type) || r.partnerAmount != null)), (r) => r.fundingSource || 'صندوق المزرعة', () => ({ SYP: 0, USD: 0 }), (a, r) => { a.SYP += n(r.paymentsSYP) + (r.partnerCurrency === 'SYP' ? n(r.partnerAmount) : 0); a.USD += n(r.paymentsUSD) + (r.partnerCurrency === 'USD' ? n(r.partnerAmount) : 0) }).map((x) => ({ source: x.key, ...x })) },
    cash: { title: 'حركة النقد والرصيد حسب العملة', cols: [['cur', 'العملة'], ['receipts', 'مقبوضات'], ['payments', 'مدفوعات'], ['net', 'الصافي']], rows: () => Object.entries(cashSummary(tx)).map(([cur, v]) => ({ cur, ...v })) },
    cattle: { title: 'جرد القطيع وحالاته', cols: [['category', 'الفئة'], ['status', 'الحالة'], ['count', 'العدد']],
      rows: () => group(cattle, (r) => `${r.category}|${r.status}`, () => ({ count: 0 }), (a) => { a.count++ }).map((x) => ({ category: x.key.split('|')[0], status: x.key.split('|')[1], count: x.count })) },
    cattleCost: { title: 'تكلفة شراء الحيوانات', cols: [['animalId', 'الرقم'], ['name', 'الاسم'], ['purchaseDate', 'التاريخ'], ['purchasePrice', 'السعر'], ['currency', 'العملة'], ['source', 'المصدر']], rows: () => cattle.filter((r) => r.purchasePrice != null) },
    vet: { title: 'المصاريف البيطرية والعلاج', cols: [['date', 'التاريخ'], ['description', 'البيان'], ['paymentsSYP', 'ل.س'], ['paymentsUSD', 'USD'], ['partnerAmount', 'شريك'], ['partnerCurrency', 'عملة الشريك']], rows: () => tx.filter((r) => r.category === 'دواء وعلاج') },
    landAcq: { title: 'تقرير اقتناء الأرض', cols: [['category', 'البند'], ['partner', 'الشريك'], ['USD', 'USD'], ['SYP', 'ل.س']],
      rows: () => group(land.filter((r) => ['ثمن شراء الأرض', 'مصاريف اقتناء الأرض'].includes(r.category)), (r) => `${r.category}|${r.partner}`, () => ({ USD: 0, SYP: 0 }), (a, r) => { a[r.currency] += n(r.amount) }).map((x) => ({ category: x.key.split('|')[0], partner: x.key.split('|')[1], USD: x.USD, SYP: x.SYP })) },
    landPrep: { title: 'تقرير تجهيز الأرض والاستثمار', cols: [['subcategory', 'التصنيف الفرعي'], ['USD', 'USD'], ['SYP', 'ل.س']],
      rows: () => group(land.filter((r) => r.category === 'مصاريف تجهيز الأرض'), (r) => r.subcategory || '—', () => ({ USD: 0, SYP: 0 }), (a, r) => { a[r.currency] += n(r.amount) }).map((x) => ({ subcategory: x.key, USD: x.USD, SYP: x.SYP })) },
    partnerExp: { title: 'مصاريف الشركاء', cols: [['partner', 'الشريك'], ['type', 'البيان'], ['amount', 'المبلغ'], ['currency', 'العملة'], ['reimbursement', 'السداد']], rows: () => pexp },
    ledger: { title: 'كشف مستحقات الشركاء وسجل السداد', cols: [['date', 'التاريخ'], ['partner', 'الشريك'], ['type', 'النوع'], ['additionSYP', 'إضافة'], ['repaymentSYP', 'سداد'], ['balance', 'الرصيد']], rows: () => ledgerBalances(ledger) },
    payroll: { title: 'كشوف مرتبات العمال (حسب الفترة)', cols: [['period', 'الشهر'], ['worker', 'العامل'], ['currency', 'العملة'], ['base', 'الأساسي'], ['bonus', 'مكافآت'], ['otherDeduction', 'خصومات'], ['advanceDeduction', 'خصم سلف'], ['net', 'الصافي'], ['paid', 'المدفوع'], ['remaining', 'المتبقي'], ['status', 'الحالة']],
      rows: () => payRows.filter((p) => p.period >= from.slice(0, 7) && p.period <= to.slice(0, 7)).sort((a, b) => a.period.localeCompare(b.period) || a.worker.localeCompare(b.worker)).map((p) => ({ ...p, remaining: remaining(p) })) },
    advances: { title: 'سلف العمال والشركاء (الأرصدة لكل عملة)', cols: [['personType', 'النوع'], ['person', 'الاسم'], ['currency', 'العملة'], ['advanced', 'إجمالي السلف'], ['repaid', 'المسدَّد/المخصوم'], ['balance', 'المتبقي']], rows: () => advanceBalances(advRows) },
    receivables: { title: 'الديون الآجلة على العملاء (لكل عملة)', cols: [['customer', 'العميل'], ['currency', 'العملة'], ['sales', 'مبيعات آجلة (متبقي عند البيع)'], ['settled', 'مسدَّد لاحقاً'], ['due', 'المتبقي']],
      rows: () => { const m = {}; const g = (c, cur) => (m[`${c}|${cur}`] ??= { customer: c, currency: cur, sales: 0, settled: 0 })
        allTx.forEach((r) => { if (r.type === 'مبيعات حليب' && r.outstanding > 0) g(r.customer || 'غير محدد', r.saleCurrency || 'SYP').sales += n(r.outstanding)
          if (r.settlesCustomer) { if (r.receiptsSYP != null) g(r.settlesCustomer, 'SYP').settled += n(r.receiptsSYP); if (r.receiptsUSD != null) g(r.settlesCustomer, 'USD').settled += n(r.receiptsUSD) } })
        return Object.values(m).map((v) => ({ ...v, due: v.sales - v.settled })) } },
    quality: { title: 'جودة البيانات والسجلات غير المطابقة', cols: [['where', 'المصدر'], ['ref', 'السجل'], ['issue', 'المشكلة']],
      rows: () => [
        ...land.filter((r) => !r.date).map((r) => ({ where: 'الأرض', ref: r.code, issue: 'بلا تاريخ' })),
        ...Object.entries(land.reduce((a, r) => ({ ...a, [r.code]: (a[r.code] || 0) + 1 }), {})).filter(([, c]) => c > 1).map(([ref]) => ({ where: 'الأرض', ref, issue: 'معرّف مكرر' })),
        ...land.filter((r) => r.status === 'بحاجة مراجعة').map((r) => ({ where: 'الأرض', ref: r.code, issue: 'بحاجة مراجعة' })),
        ...tx.filter((r) => r.partnerAmount != null && !['SYP', 'USD'].includes(r.partnerCurrency)).map((r) => ({ where: 'الصندوق', ref: r.date, issue: 'عملة مصروف الشريك ناقصة' })),
        ...cattle.filter((r) => r.motherId && !cattle.some((m) => m.animalId === r.motherId)).map((r) => ({ where: 'الأبقار', ref: r.animalId, issue: `الأم ${r.motherId} غير موجودة` })),
        ...pexp.filter((p) => !p.milkRef).map((p) => ({ where: 'مصاريف الشركاء', ref: `${p.partner} ${p.type}`, issue: 'غير مرتبط بسجل صندوق — راجع تكرار الاحتساب' })),
      ] },
  }), [tx, cattle, land, ledger, pexp, events, payRows, advRows, allTx])
  const rep = REPORTS[rid]; const data = rep.rows(); const cols = rep.cols.map(([key, label]) => ({ key, label }))
  const numKeys = data.length > 1 ? cols.filter((c) => typeof data[0][c.key] === 'number' && c.key !== 'balance').slice(0, 2) : []
  const labelKey = cols[0].key
  return (
    <div>
      <PageHeader title="التقارير"><button className="btn-ghost" onClick={() => exportRows({ filename: rid, sheet: rep.title, columns: cols, rows: data, note: `من ${from} إلى ${to}` })}><Download size={16} />تصدير Excel</button><button className="btn-ghost" onClick={() => window.print()}>طباعة</button></PageHeader>
      <div className="card mb-4 grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2"><label className="label">التقرير</label><select className="input" value={rid} onChange={(e) => setRid(e.target.value)}>{Object.entries(REPORTS).map(([k, r]) => <option key={k} value={k}>{r.title}</option>)}</select></div>
        <div><label className="label">من</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div><label className="label">إلى</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
      {numKeys.length > 0 && <div className="card mb-4"><ResponsiveContainer width="100%" height={240}><BarChart data={data.slice(0, 30)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={labelKey} tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend />{numKeys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} fill={['#2563eb', '#16a34a'][i]} />)}</BarChart></ResponsiveContainer></div>}
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{cols.map((c) => <th key={c.key} className="p-3 text-right">{c.label}</th>)}</tr></thead>
        <tbody>{data.length === 0 ? <tr><td colSpan={9}><Empty /></td></tr> : data.map((r, i) => <tr key={i} className="border-t">{cols.map((c) => <td key={c.key} className="p-3 tabular-nums">{typeof r[c.key] === 'number' ? fmtNum(r[c.key]) : String(r[c.key] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <p className="text-xs text-slate-500 mt-2">كل تقرير يعكس الفترة المحددة (التقارير المرتبطة بالأرض والقطيع والشركاء غير مقيَّدة بالتاريخ). لا يُجمع الدولار مع الليرة.</p>
    </div>
  )
}
