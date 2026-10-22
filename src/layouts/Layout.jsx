import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, PlusSquare, Droplets, Wallet, Receipt, PiggyBank, Landmark, Users, BarChart3, Settings, LogOut, Upload, HelpCircle, Menu, X, ScrollText } from 'lucide-react'
import { useAuth, can } from '../app/AuthContext'

const NAV = [
  ['/', 'الرئيسية', Home, 'read'], ['/daily', 'الدخول اليومي', PlusSquare, 'write'], ['/milk', 'إنتاج الحليب والمبيعات', Droplets, 'read'],
  ['/cashbook', 'المخزون والصندوق', Wallet, 'read'], ['/expenses', 'المصروفات', Receipt, 'read'], ['/cattle', 'الأبقار والعجول', PiggyBank, 'read'],
  ['/land', 'الأرض والاستثمار', Landmark, 'read'], ['/partners', 'الشركاء والحسابات', Users, 'read'], ['/reports', 'التقارير', BarChart3, 'read'],
  ['/import', 'استيراد Excel', Upload, 'admin'], ['/audit', 'سجل التدقيق', ScrollText, 'admin'], ['/guide', 'الدليل', HelpCircle, 'read'], ['/settings', 'الإعدادات', Settings, 'read'],
]
const ROLE_AR = { admin: 'مدير', entry: 'مدخل بيانات', viewer: 'مشاهد' }
export default function Layout() {
  const { user, role, logout } = useAuth(); const [open, setOpen] = useState(false); useLocation()
  const side = (
    <aside className="w-64 h-full bg-gradient-to-b from-brand-900 to-slate-900 text-white flex flex-col">
      <div className="p-5 border-b border-white/10 flex items-center justify-between"><div><div className="font-bold text-lg">{import.meta.env.VITE_APP_NAME || 'مزرعة آل الطرابلسي'}</div><div className="text-xs text-white/60">إدارة الماشية والحليب</div></div>
        <button className="lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button></div>
      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {NAV.filter(([, , , need]) => can(role, need)).map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-brand-600' : 'hover:bg-white/10 text-white/80'}`}><Icon size={18} />{label}</NavLink>))}
      </nav>
      <div className="p-4 border-t border-white/10 flex items-center justify-between text-sm"><div className="min-w-0"><div className="truncate">{user?.email}</div><div className="text-xs text-white/60">{ROLE_AR[role] || role}</div></div>
        <button onClick={logout} title="خروج"><LogOut size={18} /></button></div>
    </aside>)
  return (
    <div className="min-h-screen lg:flex">
      <div className="hidden lg:block sticky top-0 h-screen shrink-0">{side}</div>
      {open && <div className="lg:hidden fixed inset-0 z-40 flex"><div className="h-full">{side}</div><div className="flex-1 bg-black/40" onClick={() => setOpen(false)} /></div>}
      <main className="flex-1 min-w-0 p-3 sm:p-6">
        <div className="lg:hidden flex items-center gap-3 mb-3"><button className="btn-ghost" onClick={() => setOpen(true)}><Menu size={18} /></button><b>{import.meta.env.VITE_APP_NAME || 'مزرعة آل الطرابلسي'}</b></div>
        <Outlet />
      </main>
    </div>
  )
}
