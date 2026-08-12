"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearToken, User } from "@/lib/api";
import QuickPickLogo from "@/components/QuickPickLogo";

const NAV = [
  { href: "/admin/dashboard",     label: "Dashboard",    icon: "⚡" },
  { href: "/admin/shops",         label: "Shops",        icon: "🏪" },
  { href: "/admin/users",         label: "Users",        icon: "👥" },
  { href: "/admin/orders",        label: "Orders",       icon: "📦" },
  { href: "/admin/subscriptions", label: "Subscriptions",icon: "💳" },
  { href: "/admin/homepage",      label: "Homepage",     icon: "🌐" },
  { href: "/admin/static-pages",  label: "Static Pages", icon: "📄" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const path    = usePathname();
  const [user, setUser]           = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.get<User>("/auth/me").then((u) => {
      if (u.role !== "admin") { clearToken(); router.replace("/login"); }
      else setUser(u);
    }).catch(() => router.replace("/login"));
  }, [router]);

  const logout = () => { clearToken(); router.replace("/login"); };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center admin-bg">
        <div className="glass-card rounded-2xl p-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
          <div className="text-slate-500 text-sm font-medium">Authenticating…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-bg flex min-h-screen relative overflow-hidden">

      {/* ── Animated background blobs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="blob blob-1 float-slow" />
        <div className="blob blob-2 float-reverse" />
        <div className="blob blob-3 float-med" />
      </div>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30 w-64 flex flex-col
        glass-dark transition-transform duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>

        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/8 relative overflow-hidden">
          {/* Animated glow line at bottom */}
          <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
          {/* Subtle orb behind logo */}
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl" />
          <QuickPickLogo size={30} className="relative z-10" />
          <span className="ml-auto text-[10px] font-bold tracking-widest uppercase text-emerald-400/70 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((n, i) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-nav-item anim-slide-left anim-d${Math.min(i + 1, 8)} ${active ? "active" : ""}`}
              >
                <span className="sidebar-icon-wrap">{n.icon}</span>
                <span>{n.label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 glow-emerald" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 space-y-2 border-t border-white/8">
          {/* User card */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg shadow-emerald-500/20">
              {user.name?.charAt(0) || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.name || "Admin"}</div>
              <div className="text-xs text-slate-400 truncate">{user.phone}</div>
            </div>
          </div>

          {/* Visit site */}
          <Link href="/" className="sidebar-nav-item w-full">
            <span className="sidebar-icon-wrap">🌍</span>
            <span>Visit Site</span>
          </Link>

          {/* Sign out */}
          <button
            onClick={logout}
            className="sidebar-nav-item w-full text-left text-red-400 hover:!text-red-300 hover:!bg-red-500/10"
          >
            <span className="sidebar-icon-wrap !bg-red-500/10">🚪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">

        {/* Mobile topbar */}
        <div className="md:hidden h-14 glass border-b border-white/30 flex items-center px-4 gap-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-white/20 transition-colors"
          >
            <div className="w-5 space-y-1.5">
              <div className="h-0.5 bg-slate-700 rounded" />
              <div className="h-0.5 bg-slate-700 rounded w-3/4" />
              <div className="h-0.5 bg-slate-700 rounded" />
            </div>
          </button>
          <QuickPickLogo size={26} />
        </div>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
