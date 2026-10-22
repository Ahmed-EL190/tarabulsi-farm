import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Home,
  PlusSquare,
  Droplets,
  Wallet,
  Receipt,
  PiggyBank,
  Landmark,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Upload,
  HelpCircle,
  Menu,
  X,
  ScrollText,
} from "lucide-react";
import { useAuth, can } from "../app/AuthContext";

const NAV = [
  ["/", "الرئيسية", Home, "read"],
  ["/daily", "الدخول اليومي", PlusSquare, "write"],
  ["/milk", "إنتاج الحليب والمبيعات", Droplets, "read"],
  ["/cashbook", "المخزون والصندوق", Wallet, "read"],
  ["/expenses", "المصروفات", Receipt, "read"],
  ["/cattle", "الأبقار والعجول", PiggyBank, "read"],
  ["/land", "الأرض والاستثمار", Landmark, "read"],
  ["/partners", "الشركاء والحسابات", Users, "read"],
  ["/reports", "التقارير", BarChart3, "read"],
  ["/import", "استيراد Excel", Upload, "admin"],
  ["/audit", "سجل التدقيق", ScrollText, "admin"],
  ["/guide", "الدليل", HelpCircle, "read"],
  ["/settings", "الإعدادات", Settings, "read"],
];

const ROLE_AR = {
  admin: "مدير",
  entry: "مدخل بيانات",
  viewer: "مشاهد",
};

const APP_NAME =
  import.meta.env.VITE_APP_NAME || "مزرعة آل الطرابلسي";

function FarmLogo({ className = "h-11 w-11" }) {
  return (
    <img
      src="/favicon.svg"
      alt="شعار مزرعة آل الطرابلسي"
      className={`${className} shrink-0 object-contain`}
    />
  );
}

function Sidebar({ user, role, logout, closeMenu }) {
  return (
    <aside className="flex h-full w-64 flex-col bg-gradient-to-b from-brand-900 to-slate-900 text-white">
      {/* شعار واسم المزرعة */}
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <FarmLogo />

        <div className="min-w-0 flex-1">
          <div className="break-words text-lg font-bold leading-tight">
            {APP_NAME}
          </div>
          <div className="mt-1 text-xs text-white/60">
            إدارة الماشية والحليب
          </div>
        </div>

        <button
          type="button"
          className="shrink-0 lg:hidden"
          onClick={closeMenu}
          aria-label="إغلاق القائمة"
        >
          <X size={20} />
        </button>
      </div>

      {/* روابط الموقع */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.filter(([, , , need]) => can(role, need)).map(
          ([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-white/80 hover:bg-white/10"
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ),
        )}
      </nav>

      {/* المستخدم وتسجيل الخروج */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4 text-sm">
        <div className="min-w-0 flex-1">
          <div className="truncate">{user?.email}</div>
          <div className="text-xs text-white/60">
            {ROLE_AR[role] || role}
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          title="خروج"
          aria-label="تسجيل الخروج"
          className="shrink-0 rounded-lg p-2 hover:bg-white/10"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}

export default function Layout() {
  const { user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* القائمة الجانبية للشاشات الكبيرة */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar
          user={user}
          role={role}
          logout={logout}
          closeMenu={closeMenu}
        />
      </div>

      {/* القائمة الجانبية للشاشات الصغيرة */}
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">
            <Sidebar
              user={user}
              role={role}
              logout={logout}
              closeMenu={closeMenu}
            />
          </div>

          <button
            type="button"
            className="flex-1 bg-black/40"
            onClick={closeMenu}
            aria-label="إغلاق القائمة"
          />
        </div>
      )}

      {/* محتوى الصفحة */}
      <main className="min-w-0 flex-1 p-3 sm:p-6">
        <div className="mb-3 flex items-center gap-3 lg:hidden">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu size={18} />
          </button>

          <FarmLogo className="h-9 w-9" />

          <b className="min-w-0 break-words">{APP_NAME}</b>
        </div>

        <Outlet />
      </main>
    </div>
  );
}