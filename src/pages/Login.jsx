import { useState } from 'react'
import { useAuth } from '../app/AuthContext'
export default function Login() {
  const { login } = useAuth(); const [e, setE] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (ev) => { ev.preventDefault(); setBusy(true); setErr('')
    try { await login(e, p) } catch { setErr('بيانات الدخول غير صحيحة') } finally { setBusy(false) } }
  return (
    <div className="min-h-screen grid place-items-center bg-slate-100">
      <form onSubmit={submit} className="card w-96 space-y-4">
        <h1 className="text-xl font-bold">{import.meta.env.VITE_APP_NAME || 'مزرعة آل الطرابلسي'}</h1>
        <div><label className="label">البريد الإلكتروني</label><input className="input" type="email" value={e} onChange={(x) => setE(x.target.value)} required /></div>
        <div><label className="label">كلمة المرور</label><input className="input" type="password" value={p} onChange={(x) => setP(x.target.value)} required /></div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="btn w-full justify-center" disabled={busy}>{busy ? '…' : 'دخول'}</button>
      </form>
    </div>
  )
}
