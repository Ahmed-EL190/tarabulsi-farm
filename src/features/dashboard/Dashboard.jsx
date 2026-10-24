import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, subDays, differenceInCalendarDays, parseISO, startOfWeek, addDays, endOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { Droplets, Banknote, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection'
import { useLists } from '../../hooks/useLists'
import { useSettings } from '../../hooks/useSettings'
import { COL } from '../../services/db'
import { allTimeCash } from '../../services/aggregates'
import { cashSummary, expensesByCategory, milkProduction, ledgerBalances, landCostReport } from '../../utils/finance'
import { TruncWarn } from '../../components/ui'
import { advanceBalances } from '../../utils/advances'
import { payrollTotals } from '../../utils/payroll'

const fmt = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(v || 0)
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9']
const iso = (d) => format(d, 'yyyy-MM-dd')

function Delta({ cur, prev }) {
  if (prev === undefined || prev === null) return null
  if (!prev) return <span className="text-[11px] text-slate-400">لا مقارنة</span>
  const p = ((cur - prev) / Math.abs(prev)) * 100
  return <span className={`text-[11px] ${p >= 0 ? 'text-green-600' : 'text-red-600'}`}>{p >= 0 ? '▲' : '▼'} {Math.abs(p).toFixed(0)}% عن الفترة السابقة</span>
}
function Kpi({ icon: Icon, label, value, unit, tint, to, delta }) {
  const body = (<div className="card flex items-center gap-3 h-full hover:ring-2 ring-brand-500"><div className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${tint}`}><Icon size={20} /></div>
    <div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value} <span className="text-xs font-normal text-slate-500">{unit}</span></div>{delta}</div></div>)
  return to ? <Link to={to}>{body}</Link> : body
}

export default function Dashboard() {
  const nav = useNavigate(); const lists = useLists(); const settings = useSettings()
  const today = iso(new Date())
  const [from, setFrom] = useState(iso(subDays(new Date(), 29))); const [to, setTo] = useState(today)
  const [cur, setCur] = useState('SYP'); const [partner, setPartner] = useState(''); const [compare, setCompare] = useState(false); const [grain, setGrain] = useState('day')
  const range = useMemo(() => ({ from, to }), [from, to])
  const prevRange = useMemo(() => { const len = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1; const pt = subDays(parseISO(from), 1); return { from: iso(subDays(pt, len - 1)), to: iso(pt) } }, [from, to])
  const { rows: txAll, loading, error, truncated } = useCollection(COL.milk, range)
  const todayRange = useMemo(() => ({ from: today, to: today }), [today])
  const { rows: todayAll } = useCollection(COL.milk, todayRange)
  const { rows: prevAll } = useCollection(COL.milk, compare ? prevRange : { from: '2999-01-01', to: '2999-01-01' })
  const { rows: cattle } = useCollection(COL.cattle); const { rows: ledger } = useCollection(COL.ledger); const { rows: land } = useCollection(COL.land); const { rows: advRows } = useCollection(COL.advances); const { rows: payRows } = useCollection(COL.payroll)
  const [balance, setBalance] = useState(null); const [balErr, setBalErr] = useState('')
  useEffect(() => { allTimeCash().then(setBalance).catch((e) => setBalErr(String(e.message || e))) }, [txAll.length])

  const pick = (rows) => (partner ? rows.filter((r) => r.fundingSource === partner) : rows)
  const tx = pick(txAll); const prev = compare ? pick(prevAll) : null
  const todayRows = todayAll
  const prodToday = milkProduction(todayRows); const cashToday = cashSummary(todayRows)
  const cash = cashSummary(tx); const pcash = prev ? cashSummary(prev) : null; const cats = expensesByCategory(tx)
  const prodPeriod = milkProduction(tx); const prodPrev = prev ? milkProduction(prev) : null

  const series = useMemo(() => {
    const key = (d) => (grain === 'day' ? d : grain === 'week' ? iso(startOfWeek(parseISO(d), { weekStartsOn: 6 })) : d.slice(0, 7))
    const rng = (k) => (grain === 'day' ? [k, k] : grain === 'week' ? [k, iso(addDays(parseISO(k), 6))] : [k + '-01', iso(endOfMonth(parseISO(k + '-01')))])
    const m = {}
    tx.forEach((r) => { if (!r.date) return; const k = key(r.date); const d = (m[k] ??= { k, label: grain === 'month' ? k : k.slice(5), morning: 0, evening: 0, receipts: 0, payments: 0 })
      d.morning += Number(r.morningL) || 0; d.evening += Number(r.eveningL) || 0; d.receipts += Number(r[`receipts${cur}`]) || 0; d.payments += Number(r[`payments${cur}`]) || 0 })
    return Object.values(m).sort((a, b) => a.k.localeCompare(b.k)).map((d) => ({ ...d, range: rng(d.k) }))
  }, [tx, cur, grain])
  const goRange = (d, path = '/cashbook') => d?.range && nav(`${path}?from=${d.range[0]}&to=${d.range[1]}`)

  const pie = Object.entries(cats).map(([name, v]) => ({ name, value: v[cur] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const cattleCount = cattle.reduce((a, c) => { if (c.status === 'نشط') a[c.category] = (a[c.category] || 0) + 1; return a }, {})
  const dues = Object.entries(ledgerBalances(ledger).reduce((a, e) => ({ ...a, [e.partner]: e.balance }), {}))
  const partnerFunded = tx.reduce((a, r) => { if (r.partnerAmount != null && a[r.partnerCurrency] !== undefined) a[r.partnerCurrency] += Number(r.partnerAmount); return a }, { USD: 0, SYP: 0 })
  const landRep = useMemo(() => landCostReport(land, [...new Set(land.map((r) => r.category))], lists.partners.items), [land, lists])
  const landChart = landRep.rows.map((r) => ({ name: r.category, value: r.total[cur] })).filter((x) => x.value > 0)
  const landTotals = landRep.total; const cattlePurchase = cattle.reduce((a, c) => { if (a[c.currency] !== undefined) a[c.currency] += Number(c.purchasePrice) || 0; return a }, { USD: 0, SYP: 0 })
  const advOwed = advanceBalances(advRows).filter((b) => b.currency === cur).reduce((s, b) => s + b.balance, 0)
  const payDue = payrollTotals(payRows)[cur]?.remaining || 0
  const q = `from=${from}&to=${to}`
  const fullBal = balance ? { SYP: (settings.openingCash.SYP || 0) + balance.SYP.receipts - balance.SYP.payments, USD: (settings.openingCash.USD || 0) + balance.USD.receipts - balance.USD.payments } : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">لوحة التحكم الرئيسية</h1>
        <div className="flex gap-2 items-end flex-wrap">
          <div><label className="label">من</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">إلى</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div><label className="label">العملة</label><select className="input" value={cur} onChange={(e) => setCur(e.target.value)}><option>SYP</option><option>USD</option></select></div>
          <div><label className="label">الشريك (الممول)</label><select className="input" value={partner} onChange={(e) => setPartner(e.target.value)}><option value="">الكل</option>{lists.partners.items.map((p) => <option key={p}>{p}</option>)}</select></div>
          <label className="text-sm flex gap-1 items-center pb-2"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />قارن بالفترة السابقة</label>
        </div>
      </div>
      {compare && <p className="text-xs text-slate-500">الفترة السابقة: {prevRange.from} إلى {prevRange.to}</p>}
      <TruncWarn show={truncated} />
      {error && <div className="card text-red-600 text-sm">تعذر تحميل البيانات: {String(error.message || error)}</div>}
      {loading && <div className="text-sm text-slate-500">جارٍ التحميل…</div>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <Kpi icon={Droplets} label="إنتاج الحليب اليوم" value={fmt(prodToday.total)} unit="لتر" tint="bg-blue-100 text-blue-600" to={`/cashbook?from=${today}&to=${today}`} />
        <Kpi icon={Banknote} label="المقبوضات اليوم" value={fmt(cashToday[cur].receipts)} unit={cur} tint="bg-green-100 text-green-600" to={`/cashbook?from=${today}&to=${today}`} />
        <Kpi icon={ArrowDownCircle} label="المدفوعات اليوم" value={fmt(cashToday[cur].payments)} unit={cur} tint="bg-red-100 text-red-600" to={`/cashbook?from=${today}&to=${today}`} />
        <Kpi icon={ArrowUpCircle} label="مقبوضات الفترة" value={fmt(cash[cur].receipts)} unit={cur} tint="bg-sky-100 text-sky-600" to={`/cashbook?${q}`} delta={compare && <Delta cur={cash[cur].receipts} prev={pcash?.[cur].receipts} />} />
        <Kpi icon={Wallet} label="صافي حركة الفترة" value={fmt(cash[cur].net)} unit={cur} tint="bg-emerald-100 text-emerald-600" to={`/cashbook?${q}`} delta={compare && <Delta cur={cash[cur].net} prev={pcash?.[cur].net} />} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card bg-emerald-50 border-emerald-200"><div className="text-xs text-slate-600">رصيد الصندوق الحالي ({cur}) — من البداية + الرصيد الافتتاحي</div>
          <div className="text-2xl font-bold">{fullBal ? fmt(fullBal[cur]) : balErr ? '—' : '…'} <span className="text-sm font-normal">{cur}</span></div>
          <div className="text-[11px] text-slate-500">الافتتاحي: {fmt(settings.openingCash[cur])} (يُضبط من الإعدادات)</div>{balErr && <div className="text-[11px] text-red-600">{balErr}</div>}</div>
        <div className="card"><div className="text-xs text-slate-500">إنتاج الفترة (لتر)</div><div className="text-2xl font-bold">{fmt(prodPeriod.total)}</div>{compare && <Delta cur={prodPeriod.total} prev={prodPrev?.total} />}<div className="text-[11px] text-slate-500">صباحاً {fmt(prodPeriod.morning)} / مساءً {fmt(prodPeriod.evening)}</div></div>
        <div className="card"><div className="text-xs text-slate-500">مصروفات الفترة ({cur})</div><div className="text-2xl font-bold">{fmt(pie.reduce((s, x) => s + x.value, 0))}</div>{compare && <Delta cur={pie.reduce((s, x) => s + x.value, 0)} prev={prev ? Object.values(expensesByCategory(prev)).reduce((s, v) => s + v[cur], 0) : null} />}</div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-4 text-sm">
        <Link to={`/expenses?category=علف&${q}`} className="card hover:ring-2 ring-brand-500">علف ({cur})<div className="text-lg font-bold">{fmt(cats['علف']?.[cur])}</div></Link>
        <Link to={`/expenses?category=${encodeURIComponent('دواء وعلاج')}&${q}`} className="card hover:ring-2 ring-brand-500">دواء وعلاج ({cur})<div className="text-lg font-bold">{fmt(cats['دواء وعلاج']?.[cur])}</div></Link>
        <Link to="/partners" className="card hover:ring-2 ring-brand-500">مموَّل من الشركاء ({cur})<div className="text-lg font-bold">{fmt(partnerFunded[cur])}</div></Link>
        <Link to="/land" className="card hover:ring-2 ring-brand-500">استثمار الأرض ({cur})<div className="text-lg font-bold">{fmt(landTotals[cur])}</div></Link>
        <Link to="/advances" className="card hover:ring-2 ring-brand-500">سلف مستحقة ({cur})<div className="text-lg font-bold">{fmt(advOwed)}</div></Link>
        <Link to="/payroll" className="card hover:ring-2 ring-brand-500">مرتبات غير مدفوعة ({cur})<div className="text-lg font-bold">{fmt(payDue)}</div></Link>
        <Link to="/cattle" className="card hover:ring-2 ring-brand-500">شراء القطيع ({cur})<div className="text-lg font-bold">{fmt(cattlePurchase[cur])}</div></Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card"><h3 className="font-bold mb-2">الحيوانات النشطة</h3>
          {Object.keys(cattleCount).length === 0 ? <p className="text-sm text-slate-500">لا توجد حيوانات.</p> : Object.entries(cattleCount).map(([k, v]) => <Link to={`/cattle`} key={k} className="flex justify-between py-1.5 border-b last:border-0"><span>{k}</span><b>{v}</b></Link>)}</div>
        <div className="card"><h3 className="font-bold mb-2">توزيع المصروفات ({cur}) — اضغط شريحة</h3>
          {pie.length === 0 ? <p className="text-sm text-slate-500">لا مصروفات في الفترة.</p> :
            <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} onClick={(d) => nav(`/expenses?category=${encodeURIComponent(d.name)}&${q}`)}>{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer" />)}</Pie><Tooltip formatter={fmt} /><Legend /></PieChart></ResponsiveContainer>}</div>
        <div className="card"><h3 className="font-bold mb-2">مستحقات الشركاء (ل.س)</h3>
          {dues.length === 0 ? <p className="text-sm text-slate-500">لا أرصدة.</p> : dues.map(([p, b]) => <Link to="/partners" key={p} className="flex justify-between py-1.5 border-b last:border-0"><span>{p}</span><b>{fmt(b)}</b></Link>)}</div>
      </div>

      <div className="flex gap-2 items-center text-sm"><span>تجميع الرسوم:</span>{[['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري']].map(([k, l]) => <button key={k} onClick={() => setGrain(k)} className={grain === k ? 'btn' : 'btn-ghost'}>{l}</button>)}<span className="text-xs text-slate-500">اضغط عموداً لعرض سجلاته</span></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card"><h3 className="font-bold mb-2">إنتاج الحليب (لتر)</h3>
          <ResponsiveContainer width="100%" height={240}><BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend /><Bar dataKey="morning" name="صباحي" fill="#2563eb" onClick={(d) => goRange(d)} cursor="pointer" /><Bar dataKey="evening" name="مسائي" fill="#38bdf8" onClick={(d) => goRange(d)} cursor="pointer" /></BarChart></ResponsiveContainer></div>
        <div className="card"><h3 className="font-bold mb-2">الإيرادات والمصروفات النقدية ({cur})</h3>
          <ResponsiveContainer width="100%" height={240}><BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={fmt} /><Legend /><Bar dataKey="receipts" name="مقبوضات" fill="#16a34a" onClick={(d) => goRange(d)} cursor="pointer" /><Bar dataKey="payments" name="مدفوعات" fill="#ef4444" onClick={(d) => goRange(d)} cursor="pointer" /></BarChart></ResponsiveContainer></div>
        <div className="card"><h3 className="font-bold mb-2">تكلفة الأرض حسب التصنيف ({cur})</h3>
          {landChart.length === 0 ? <p className="text-sm text-slate-500">لا سجلات بهذه العملة.</p> : <ResponsiveContainer width="100%" height={240}><BarChart data={landChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} /><YAxis /><Tooltip formatter={fmt} /><Bar dataKey="value" name="المبلغ" fill="#8b5cf6" onClick={() => nav('/land')} cursor="pointer" /></BarChart></ResponsiveContainer>}</div>
        <div className="card"><h3 className="font-bold mb-2">أرصدة الشركاء (ل.س)</h3>
          {dues.length === 0 ? <p className="text-sm text-slate-500">لا أرصدة.</p> : <ResponsiveContainer width="100%" height={240}><BarChart data={dues.map(([name, value]) => ({ name, value }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={fmt} /><Bar dataKey="value" name="الرصيد" fill="#f59e0b" onClick={() => nav('/partners')} cursor="pointer" /></BarChart></ResponsiveContainer>}</div>
      </div>
      <p className="text-xs text-slate-500">لا يُجمع الدولار مع الليرة. مصروف الشريك يُحتسب مصروفاً ولا يخصم من الصندوق. رصيد الصندوق الحالي محسوب على كل السجلات من الخادم، أما باقي الأرقام فتخص الفترة المحددة.</p>
    </div>
  )
}
