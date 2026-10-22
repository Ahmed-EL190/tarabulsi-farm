import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between p-4 border-b"><h3 className="font-bold">{title}</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
export function Confirm({ message, onYes, onNo }) {
  return <Modal title="تأكيد" onClose={onNo}><p className="mb-4">{message}</p><div className="flex gap-2 justify-end"><button className="btn-ghost" onClick={onNo}>إلغاء</button><button className="btn" onClick={onYes}>تأكيد</button></div></Modal>
}
export function Toast({ msg, kind = 'ok', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return <div className={`fixed bottom-5 left-5 z-[60] px-4 py-2 rounded-lg text-white text-sm ${kind === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>{msg}</div>
}
export function useToast() {
  const [t, setT] = useState(null)
  return { show: (msg, kind) => setT({ msg, kind }), node: t && <Toast {...t} onDone={() => setT(null)} /> }
}
export const Empty = ({ text = 'لا توجد سجلات.' }) => <div className="p-8 text-center text-slate-500 text-sm">{text}</div>
export function Pagination({ page, pages, setPage }) {
  if (pages <= 1) return null
  return <div className="flex items-center justify-center gap-3 py-3 text-sm"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button><span>{page} / {pages}</span><button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>التالي</button></div>
}
export const fmtNum = (v) => (v === null || v === undefined || v === '' ? '' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v))
export const PageHeader = ({ title, children }) => <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h1 className="text-2xl font-bold">{title}</h1><div className="flex gap-2 flex-wrap">{children}</div></div>
export const TruncWarn = ({ show }) => show ? <div className="card border-amber-400 bg-amber-50 text-amber-800 text-sm mb-3">تنبيه: عدد السجلات كبير والمعروض هو أحدث 3000 سجل فقط. ضيّق نطاق التاريخ للحصول على أرقام كاملة.</div> : null
