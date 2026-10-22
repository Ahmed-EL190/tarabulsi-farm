import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, can } from './AuthContext'
import Layout from '../layouts/Layout'
import Login from '../pages/Login'
import CrudPage from '../components/CrudPage'
import { cashbookCfg, productionCfg, expensesCfg } from '../features/milk/configs.jsx'
import { landCfg } from '../features/land/configs'

const Dashboard = lazy(() => import('../features/dashboard/Dashboard'))
const DailyEntry = lazy(() => import('../features/daily-entry/DailyEntry'))
const LandCost = lazy(() => import('../features/land/LandCost'))
const Cattle = lazy(() => import('../features/cattle/Cattle'))
const CattleProfile = lazy(() => import('../features/cattle/CattleProfile'))
const Partners = lazy(() => import('../features/partners/Partners'))
const Reports = lazy(() => import('../features/reports/Reports'))
const Settings = lazy(() => import('../features/settings/Settings'))
const Guide = lazy(() => import('../features/settings/Guide'))
const AuditLog = lazy(() => import('../features/settings/AuditLog'))
const ImportWizard = lazy(() => import('../features/imports/ImportWizard'))

const Land = () => <div className="space-y-8"><CrudPage cfg={landCfg} /><Suspense fallback={null}><LandCost /></Suspense></div>
const Guard = ({ need, children }) => { const { role } = useAuth(); return can(role, need) ? children : <div className="card">ليست لديك صلاحية لهذه الصفحة.</div> }

export default function App() {
  const { user, role, ready, configured, logout } = useAuth()
  if (!configured) return <div className="p-10 text-center">أضف إعدادات Firebase في ملف <code>.env</code> (انظر <code>.env.example</code>) ثم أعد التشغيل.</div>
  if (!ready) return <div className="p-10 text-center">جارٍ التحميل…</div>
  if (!user) return <Login />
  if (role === 'none') return <div className="min-h-screen grid place-items-center p-6"><div className="card max-w-md text-center space-y-3"><h2 className="font-bold text-lg">لا توجد صلاحية لحسابك</h2><p className="text-sm">حسابك ({user.email}) لم تُعيَّن له صلاحية بعد. اطلب من المدير تعيينها ثم سجّل الدخول من جديد.</p><button className="btn mx-auto" onClick={logout}>تسجيل الخروج</button></div></div>
  return (
    <Suspense fallback={<div className="p-10 text-center">جارٍ التحميل…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="daily" element={<Guard need="write"><DailyEntry /></Guard>} />
          <Route path="milk" element={<CrudPage cfg={productionCfg} />} />
          <Route path="cashbook" element={<CrudPage cfg={cashbookCfg} />} />
          <Route path="expenses" element={<CrudPage cfg={expensesCfg} />} />
          <Route path="cattle" element={<Cattle />} />
          <Route path="cattle/:id" element={<CattleProfile />} />
          <Route path="land" element={<Land />} />
          <Route path="partners" element={<Partners />} />
          <Route path="reports" element={<Reports />} />
          <Route path="import" element={<Guard need="admin"><ImportWizard /></Guard>} />
          <Route path="audit" element={<Guard need="admin"><AuditLog /></Guard>} />
          <Route path="settings" element={<Settings />} />
          <Route path="guide" element={<Guide />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
