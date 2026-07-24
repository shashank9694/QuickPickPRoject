"use client";
import { useEffect, useState } from "react";
import { api, Analytics } from "@/lib/api";
import Link from "next/link";

function StatCard({ icon, label, value, sub, href }: { icon: string; label: string; value: string | number; sub?: string; href?: string }) {
  const content = (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-emerald-200 transition-all">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {href && <span className="text-xs text-emerald-600 font-semibold">View →</span>}
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Analytics>("/admin/analytics").then((d) => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading…</div>;
  if (!stats) return <div className="text-red-500 text-sm p-4">Failed to load analytics.</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Platform overview at a glance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="👥" label="Total Users" value={stats.total_users} sub={`${stats.customers} customers · ${stats.shopkeepers} shopkeepers`} href="/admin/users" />
        <StatCard icon="🏪" label="Active Shops" value={stats.active_shops} sub={`${stats.pending_shops} pending approval`} href="/admin/shops" />
        <StatCard icon="📦" label="Total Orders" value={stats.total_orders} sub={`${stats.completed_orders} completed`} href="/admin/orders" />
        <StatCard icon="💰" label="GMV" value={`₹${stats.revenue.toLocaleString("en-IN")}`} sub="Gross order value" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <StatCard icon="💳" label="Subscription Revenue" value={`₹${stats.subscription_revenue.toLocaleString("en-IN")}`} sub="From active plans" href="/admin/subscriptions" />
        {stats.pending_shops > 0 && (
          <Link href="/admin/shops?status=pending">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">⚠️</span>
                <span className="font-bold text-amber-800">{stats.pending_shops} shops awaiting approval</span>
              </div>
              <p className="text-sm text-amber-700">Review and approve or reject pending shop registrations.</p>
              <div className="mt-3 text-sm font-bold text-amber-700">Review now →</div>
            </div>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/admin/shops", label: "Approve Shops", icon: "✅" },
            { href: "/admin/users", label: "Manage Users", icon: "👥" },
            { href: "/admin/subscriptions", label: "Edit Plans", icon: "💳" },
            { href: "/admin/static-pages", label: "Edit Pages", icon: "📄" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="flex items-center gap-2 p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl text-sm font-medium text-slate-700 hover:text-emerald-700 transition-all">
              <span>{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
