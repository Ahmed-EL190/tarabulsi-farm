import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from '../layouts/Layout'
import Login from '../pages/Login'
import Dashboard from '../features/dashboard/Dashboard'
import DailyEntry from '../features/daily-entry/DailyEntry'
import CrudPage from '../components/CrudPage'
import { cashbookCfg, productionCfg, expensesCfg } from '../features/milk/configs.jsx'
import { landCfg } from '../features/land/configs'
import LandCost from '../features/land/LandCost'
import Cattle from '../features/cattle/Cattle'
import CattleProfile from '../features/cattle/CattleProfile'
import Partners from '../features/partners/Partners'
import Reports from '../features/reports/Reports'
import Settings from '../features/settings/Settings'
import Guide from '../features/settings/Guide'
import ImportWizard from '../features/imports/ImportWizard'

const Land = () => <div className="space-y-8"><CrudPage cfg={landCfg} /><LandCost /></div>
export default function App() {
  const { user, ready, configured } = useAuth()
  if (!configured) return <div className="p-10 text-center">أضف إعدادات Firebase في ملف <code>.env</code> (انظر <code>.env.example</code>) ثم أعد التشغيل.</div>
  if (!ready) return <div className="p-10 text-center">جارٍ التحميل…</div>
  if (!user) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="daily" element={<DailyEntry />} />
        <Route path="milk" element={<CrudPage cfg={productionCfg} />} />
        <Route path="cashbook" element={<CrudPage cfg={cashbookCfg} />} />
        <Route path="expenses" element={<CrudPage cfg={expensesCfg} />} />
        <Route path="cattle" element={<Cattle />} />
        <Route path="cattle/:id" element={<CattleProfile />} />
        <Route path="land" element={<Land />} />
        <Route path="partners" element={<Partners />} />
        <Route path="reports" element={<Reports />} />
        <Route path="import" element={<ImportWizard />} />
        <Route path="settings" element={<Settings />} />
        <Route path="guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  )
}
