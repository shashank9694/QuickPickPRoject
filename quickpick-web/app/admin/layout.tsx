"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearToken, User } from "@/lib/api";

const NAV = [
  { href: "/admin/dashboard",    label: "Dashboard",    icon: "📊" },
  { href: "/admin/shops",        label: "Shops",        icon: "🏪" },
  { href: "/admin/users",        label: "Users",        icon: "👥" },
  { href: "/admin/orders",       label: "Orders",       icon: "📦" },
  { href: "/admin/subscriptions",label: "Subscriptions",icon: "💳" },
  { href: "/admin/homepage",     label: "Homepage",     icon: "🌐" },
  { href: "/admin/static-pages", label: "Static Pages", icon: "📄" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.get<User>("/auth/me").then((u) => {
      if (u.role !== "admin") { clearToken(); router.replace("/login"); }
      else setUser(u);
    }).catch(() => { router.replace("/login"); });
  }, [router]);

  const logout = () => { clearToken(); router.replace("/login"); };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-100">
          <span className="text-xl">🛍️</span>
          <span className="font-extrabold text-emerald-600 text-lg">QuickPick</span>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full ml-auto">Admin</span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                <span className="text-lg">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
              {user.name?.charAt(0) || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">{user.name || "Admin"}</div>
              <div className="text-xs text-slate-400 truncate">{user.phone}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full text-sm text-slate-500 hover:text-red-500 py-2 border border-slate-200 hover:border-red-200 rounded-xl transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="md:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <div className="w-5 h-0.5 bg-slate-600 mb-1"></div>
            <div className="w-5 h-0.5 bg-slate-600 mb-1"></div>
            <div className="w-5 h-0.5 bg-slate-600"></div>
          </button>
          <span className="font-bold text-slate-800">QuickPick Admin</span>
        </div>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
