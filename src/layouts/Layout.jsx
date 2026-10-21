import { NavLink, Outlet } from 'react-router-dom'
import { Home, PlusSquare, Droplets, Wallet, Receipt, PiggyBank, Landmark, Users, BarChart3, Settings, LogOut, Upload, HelpCircle } from 'lucide-react'
import { useAuth } from '../app/AuthContext'

const NAV = [
  ['/', 'الرئيسية', Home], ['/daily', 'الدخول اليومي', PlusSquare], ['/milk', 'إنتاج الحليب والمبيعات', Droplets],
  ['/cashbook', 'المخزون والصندوق', Wallet], ['/expenses', 'المصروفات', Receipt], ['/cattle', 'الأبقار والعجول', PiggyBank],
  ['/land', 'الأرض والاستثمار', Landmark], ['/partners', 'الشركاء والحسابات', Users], ['/reports', 'التقارير', BarChart3], ['/import', 'استيراد Excel', Upload], ['/guide', 'الدليل', HelpCircle], ['/settings', 'الإعدادات', Settings],
]
export default function Layout() {
  const { user, role, logout } = useAuth()
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-gradient-to-b from-brand-900 to-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-white/10"><div className="font-bold text-lg">{import.meta.env.VITE_APP_NAME || 'مزرعة آل الطرابلسي'}</div><div className="text-xs text-white/60">إدارة الماشية والحليب</div></div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-brand-600' : 'hover:bg-white/10 text-white/80'}`}><Icon size={18} />{label}</NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 flex items-center justify-between text-sm">
          <div><div>{user?.email}</div><div className="text-xs text-white/60">{role}</div></div>
          <button onClick={logout} title="خروج"><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-hidden"><Outlet /></main>
    </div>
  )
}
