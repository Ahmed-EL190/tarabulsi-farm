import { useState } from 'react'
import { Upload, Download } from 'lucide-react'
import { parseWorkbook, reconcile } from '../../utils/excelParser'
import { mapWorkbook } from '../../utils/importMap'
import { runImport, verifyImport, getJob, sha256, restoreBackup } from '../../services/importer'
import { listRange } from '../../services/db'
import { COL } from '../../services/collections'
import { exportRows } from '../../utils/exportExcel'
import { useAuth, can } from '../../app/AuthContext'
import { PageHeader, Confirm, fmtNum, useToast } from '../../components/ui'

export default function ImportWizard() {
  const { role } = useAuth(); const toast = useToast()
  const [st, setSt] = useState({}); const [ask, setAsk] = useState(false); const [prog, setProg] = useState(null); const [ver, setVer] = useState(null); const [busy, setBusy] = useState(false)
  if (!can(role, 'admin')) return <div className="card">الاستيراد والنسخ الاحتياطي للمدير فقط.</div>
  const pick = async (e) => {
    const f = e.target.files[0]; if (!f) return; setBusy(true); setVer(null)
    try { const buf = await f.arrayBuffer(); const hash = await sha256(buf); const parsed = await parseWorkbook(buf); const job = await getJob(hash.slice(0, 32))
      setSt({ f, hash, parsed, rec: reconcile(parsed), job, map: mapWorkbook(parsed, hash.slice(0, 32)) }) } catch (err) { toast.show('تعذّر قراءة الملف: ' + err.message, 'err') } finally { setBusy(false) }
  }
  const go = async () => { setAsk(false); setBusy(true)
    try { const id = await runImport({ parsed: st.parsed, fileName: st.f.name, fileHash: st.hash, onProgress: (a, b) => setProg([a, b]) }); setVer(await verifyImport(id, st.rec)); toast.show('اكتمل الاستيراد') }
    catch (e) { toast.show('توقف الاستيراد: ' + e.message + ' — أعد المحاولة لاستكماله', 'err') } finally { setBusy(false) } }
  const backup = async () => {
    setBusy(true); try { for (const [k, c] of Object.entries({ milk: COL.milk, land: COL.land, cattle: COL.cattle, events: COL.cattleEvents, partnerExpenses: COL.partnerExpenses, ledger: COL.ledger })) {
      const rows = (await listRange(c, { max: 10000 })).map(({ createdAt, updatedAt, ...r }) => r); const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
      await exportRows({ filename: `backup_${k}`, sheet: k, columns: keys.map((x) => ({ key: x, label: x })), rows } ) } } catch (e) { toast.show(e.message, 'err') } finally { setBusy(false) } }
  const [rest, setRest] = useState(null); const [restRes, setRestRes] = useState(null)
  const doRestore = async () => { const files = rest; setRest(null); setBusy(true); try { setRestRes(await restoreBackup(files, (n) => setProg([n, '…']))); toast.show('اكتملت الاستعادة') } catch (e) { toast.show('فشلت الاستعادة: ' + e.message, 'err') } finally { setBusy(false) } }
  const errReport = () => exportRows({ filename: 'import_issues', sheet: 'Issues', columns: [{ key: 'sheet', label: 'الشيت' }, { key: 'row', label: 'الصف' }, { key: 'code', label: 'الرمز' }, { key: 'msg', label: 'الوصف' }], rows: st.parsed.issues })
  const r = st.rec
  return (
    <div className="space-y-4">
      <PageHeader title="استيراد Excel والنسخ الاحتياطي"><button className="btn-ghost" disabled={busy} onClick={backup}><Download size={16} />نسخة احتياطية كاملة (Excel)</button></PageHeader>
      <div className="card"><p className="text-sm mb-3">1) خذ نسخة احتياطية أولاً. 2) اختر ملف .xlsx (لن يُعدَّل الأصل). 3) راجع المعاينة والمطابقة ثم أكّد.</p>
        <label className="btn cursor-pointer w-fit"><Upload size={16} />اختيار الملف<input type="file" accept=".xlsx" hidden onChange={pick} /></label></div>
      <div className="card"><h3 className="font-bold mb-1">استعادة من نسخة احتياطية</h3><p className="text-sm mb-3">اختر ملفات النسخ الاحتياطية (backup_milk وbackup_land وغيرها) التي صدّرها الموقع. تُكتب السجلات بنفس معرّفاتها فتحلّ محل الحالية.</p>
        <label className="btn-ghost cursor-pointer w-fit"><Upload size={16} />اختيار ملفات النسخ<input type="file" accept=".xlsx" multiple hidden onChange={(e) => e.target.files.length && setRest([...e.target.files])} /></label>
        {restRes && <ul className="text-sm mt-3">{restRes.map((r) => <li key={r.sheet}>{r.sheet}: {fmtNum(r.count)} سجل</li>)}</ul>}</div>
      {st.parsed && <>
        {st.job && <div className="card bg-amber-50 text-sm">هذا الملف استُورد سابقاً (الحالة: {st.job.status}). إعادة الاستيراد آمنة ولا تكرر السجلات؛ إن كان متوقفاً سيُستكمل.</div>}
        <div className="card"><h3 className="font-bold mb-2">المعاينة والمطابقة مع الملف المصدر</h3>
          <table className="w-full text-sm"><tbody>{[['سجلات Milk_Box', r.counts.milk], ['سجلات Transactions', r.counts.land], ['صفوف Cattle_Master', r.counts.cattle], ['Partner-Depts (مخفي)', r.counts.partnerExpenses], ['Partner_Ledger', r.counts.ledger],
            ['مقبوضات ل.س', r.milk.receiptsSYP], ['مدفوعات ل.س', r.milk.paymentsSYP], ['مصاريف شركاء ل.س', r.milk.partnerSYP], ['مصاريف شركاء USD', r.milk.partnerUSD], ['إجمالي الأرض USD', r.land.USD], ['شراء القطيع ل.س', r.cattle.purchaseSYP], ['الرصيد الافتتاحي ل.س', r.ledgerOpening]].map(([l, v]) => <tr key={l} className="border-t"><td className="p-2">{l}</td><td className="p-2 tabular-nums">{fmtNum(v)}</td></tr>)}</tbody></table>
          <p className="text-xs text-slate-500 mt-2">سيُنشأ {st.map.docs.length} مستند (يشمل العجول المستخرجة من صفوف الأمهات).</p></div>
        <div className="card"><div className="flex justify-between mb-2"><h3 className="font-bold">تحذيرات ({st.parsed.issues.length})</h3><button className="btn-ghost" onClick={errReport}>تنزيل تقرير الأخطاء</button></div>
          <ul className="text-sm max-h-60 overflow-auto">{st.parsed.issues.slice(0, 200).map((i, k) => <li key={k} className="border-t py-1">{i.sheet} {i.row ? `#${i.row}` : ''} — {i.code}: {i.msg}</li>)}</ul></div>
        <button className="btn" disabled={busy} onClick={() => setAsk(true)}>{busy ? 'جارٍ العمل…' : 'تأكيد الاستيراد إلى Firebase'}</button>
        {prog && <p className="text-sm">تمت كتابة {prog[0]} / {prog[1]}</p>}
      </>}
      {ver && <div className="card"><h3 className="font-bold mb-2">نتيجة التحقق بعد الاستيراد</h3><table className="w-full text-sm"><tbody>{ver.map((x) => <tr key={x.check} className="border-t"><td className="p-2">{x.check}</td><td className="p-2">{fmtNum(x.expected)}</td><td className="p-2">{fmtNum(x.actual)}</td><td className={`p-2 font-bold ${x.ok ? 'text-green-600' : 'text-red-600'}`}>{x.ok ? '✓ مطابق' : '✗ غير مطابق'}</td></tr>)}</tbody></table></div>}
      {rest && <Confirm message={`سيتم استعادة ${rest.length} ملف (تُستبدل السجلات التي لها نفس المعرّف). متابعة؟`} onYes={doRestore} onNo={() => setRest(null)} />}
      {ask && <Confirm message="سيتم كتابة السجلات إلى قاعدة البيانات. متابعة؟" onYes={go} onNo={() => setAsk(false)} />}
      {toast.node}
    </div>
  )
}
