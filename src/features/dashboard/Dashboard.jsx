import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { Link } from 'react-router-dom'
import { Droplets, Banknote, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { COL } from '../../services/db'
import { cashSummary, expensesByCategory, milkProduction, ledgerBalances } from '../../utils/finance'

const fmt = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(v || 0)
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9']

function Kpi({ icon: Icon, label, value, unit, tint }) {
  return (
    <div className="card flex items-center gap-3">
      <div className={`w-11 h-11 rounded-full grid place-items-center ${tint}`}><Icon size={20} /></div>
      <div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value} <span className="text-xs font-normal text-slate-500">{unit}</span></div></div>
    </div>
  )
}

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo] = useState(today)
  const [cur, setCur] = useState('SYP')
  const range = useMemo(() => ({ from, to }), [from, to])
  const { rows: tx, loading, error } = useCollection(COL.milk, range)
  const { rows: cattle } = useCollection(COL.cattle)
  const { rows: ledger } = useCollection(COL.ledger)

  const todayRows = tx.filter((r) => r.date === today)
  const prodToday = milkProduction(todayRows)
  const cashToday = cashSummary(todayRows)
  const cash = cashSummary(tx)
  const cats = expensesByCategory(tx)
  const days = useMemo(() => {
    const m = {}; tx.forEach((r) => { const d = (m[r.date] ??= { date: r.date.slice(5), morning: 0, evening: 0, receipts: 0, payments: 0 })
      d.morning += Number(r.morningL) || 0; d.evening += Number(r.eveningL) || 0; d.receipts += Number(cur === 'SYP' ? r.receiptsSYP : r.receiptsUSD) || 0; d.payments += Number(cur === 'SYP' ? r.paymentsSYP : r.paymentsUSD) || 0 })
    return Object.values(m).sort((a, b) => a.date.localeCompare(b.date))
  }, [tx, cur])
  const pie = Object.entries(cats).map(([name, v]) => ({ name, value: v[cur] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const cattleCount = cattle.reduce((a, c) => { a[c.category] = (a[c.category] || 0) + (c.status === 'نشط' ? 1 : 0); return a }, {})
  const land = useCollection(COL.land).rows
  const landTotals = land.reduce((a, r) => { if (a[r.currency] !== undefined) a[r.currency] += Number(r.amount) || 0; return a }, { USD: 0, SYP: 0 })
  const cattlePurchase = cattle.reduce((a, c) => { if (a[c.currency] !== undefined) a[c.currency] += Number(c.purchasePrice) || 0; return a }, { USD: 0, SYP: 0 })
  const partnerFunded = tx.reduce((a, r) => { if (r.partnerAmount != null && a[r.partnerCurrency] !== undefined) a[r.partnerCurrency] += Number(r.partnerAmount); return a }, { USD: 0, SYP: 0 })
  const dues = Object.entries(ledgerBalances(ledger).reduce((a, e) => ({ ...a, [e.partner]: e.balance }), {}))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">لوحة التحكم الرئيسية</h1>
        <div className="flex gap-2 items-end">
          <div><label className="label">من</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">إلى</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div><label className="label">العملة</label><select className="input" value={cur} onChange={(e) => setCur(e.target.value)}><option>SYP</option><option>USD</option></select></div>
        </div>
      </div>
      {error && <div className="card text-red-600 text-sm">تعذر تحميل البيانات: {String(error.message || error)}</div>}
      {loading && <div className="text-sm text-slate-500">جارٍ التحميل…</div>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <Kpi icon={Droplets} label="إجمالي إنتاج الحليب اليوم" value={fmt(prodToday.total)} unit="لتر" tint="bg-blue-100 text-blue-600" />
        <Kpi icon={Banknote} label="المقبوضات اليوم" value={fmt(cashToday[cur].receipts)} unit={cur} tint="bg-green-100 text-green-600" />
        <Kpi icon={ArrowDownCircle} label="المدفوعات اليوم" value={fmt(cashToday[cur].payments)} unit={cur} tint="bg-red-100 text-red-600" />
        <Kpi icon={ArrowUpCircle} label={`مقبوضات الفترة (${cur})`} value={fmt(cash[cur].receipts)} unit={cur} tint="bg-sky-100 text-sky-600" />
        <Kpi icon={Wallet} label={`صافي الصندوق (${cur})`} value={fmt(cash[cur].net)} unit={cur} tint="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 text-sm">
        <Link to="/expenses" className="card hover:ring-2 ring-brand-500">علف ({cur})<div className="text-lg font-bold">{fmt(cats['علف']?.[cur])}</div></Link>
        <Link to="/reports" className="card hover:ring-2 ring-brand-500">دواء وعلاج ({cur})<div className="text-lg font-bold">{fmt(cats['دواء وعلاج']?.[cur])}</div></Link>
        <Link to="/partners" className="card hover:ring-2 ring-brand-500">مموَّل من الشركاء ({cur})<div className="text-lg font-bold">{fmt(partnerFunded[cur])}</div></Link>
        <Link to="/land" className="card hover:ring-2 ring-brand-500">استثمار الأرض ({cur})<div className="text-lg font-bold">{fmt(landTotals[cur])}</div></Link>
        <Link to="/cattle" className="card hover:ring-2 ring-brand-500">شراء القطيع ({cur})<div className="text-lg font-bold">{fmt(cattlePurchase[cur])}</div></Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-1"><h3 className="font-bold mb-2">عدد الحيوانات النشطة</h3>
          {Object.keys(cattleCount).length === 0 ? <p className="text-sm text-slate-500">لا توجد حيوانات مسجلة بعد.</p> :
            Object.entries(cattleCount).map(([k, v]) => <div key={k} className="flex justify-between py-1.5 border-b last:border-0"><span>{k}</span><b>{v}</b></div>)}
        </div>
        <div className="card lg:col-span-1"><h3 className="font-bold mb-2">توزيع المصروفات ({cur})</h3>
          {pie.length === 0 ? <p className="text-sm text-slate-500">لا توجد مصروفات في الفترة.</p> :
            <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={fmt} /><Legend /></PieChart></ResponsiveContainer>}
        </div>
        <div className="card lg:col-span-1"><h3 className="font-bold mb-2">مستحقات الشركاء (ل.س)</h3>
          {dues.length === 0 ? <p className="text-sm text-slate-500">لا توجد أرصدة.</p> : dues.map(([p, b]) => <div key={p} className="flex justify-between py-1.5 border-b last:border-0"><span>{p}</span><b>{fmt(b)}</b></div>)}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card"><h3 className="font-bold mb-2">إنتاج الحليب اليومي (لتر)</h3>
          <ResponsiveContainer width="100%" height={240}><BarChart data={days}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Bar dataKey="morning" name="صباحي" fill="#2563eb" /><Bar dataKey="evening" name="مسائي" fill="#38bdf8" /></BarChart></ResponsiveContainer></div>
        <div className="card"><h3 className="font-bold mb-2">حركة النقد ({cur})</h3>
          <ResponsiveContainer width="100%" height={240}><BarChart data={days}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={fmt} /><Legend /><Bar dataKey="receipts" name="مقبوضات" fill="#16a34a" /><Bar dataKey="payments" name="مدفوعات" fill="#ef4444" /></BarChart></ResponsiveContainer></div>
      </div>
      <p className="text-xs text-slate-500">لا يتم جمع الليرة والدولار في رقم واحد. المصاريف التي دفعها الشريك تُحتسب مصروفاً ولا تُحتسب حركة نقد في الصندوق.</p>
    </div>
  )
}
