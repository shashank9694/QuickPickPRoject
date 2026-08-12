"use client";
import { useEffect, useState } from "react";
import { api, Analytics } from "@/lib/api";
import Link from "next/link";

function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const totalFrames = Math.round(duration / 16);
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = () => {
      frame++;
      setCount(Math.round(easeOut(frame / totalFrames) * target));
      if (frame < totalFrames) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}

const CARDS = (s: Analytics) => [
  {
    icon: "👥", label: "Total Users", value: s.total_users, isNum: true,
    sub: `${s.customers} customers · ${s.shopkeepers} shopkeepers`,
    href: "/admin/users",
    accent: "from-blue-400 to-indigo-500",
    orb: "rgba(99,102,241,0.15)",
    delay: "anim-d1",
  },
  {
    icon: "🏪", label: "Active Shops", value: s.active_shops, isNum: true,
    sub: `${s.pending_shops} pending approval`,
    href: "/admin/shops",
    accent: "from-emerald-400 to-teal-500",
    orb: "rgba(16,185,129,0.15)",
    delay: "anim-d2",
  },
  {
    icon: "📦", label: "Total Orders", value: s.total_orders, isNum: true,
    sub: `${s.completed_orders} completed`,
    href: "/admin/orders",
    accent: "from-violet-400 to-purple-500",
    orb: "rgba(139,92,246,0.15)",
    delay: "anim-d3",
  },
  {
    icon: "💰", label: "Gross Value", value: s.revenue, isNum: true, prefix: "₹",
    sub: "Total order GMV",
    accent: "from-amber-400 to-orange-500",
    orb: "rgba(245,158,11,0.15)",
    delay: "anim-d4",
  },
];

function StatCard({ icon, label, value, sub, href, accent, orb, delay, isNum, prefix = "" }: {
  icon: string; label: string; value: number; sub: string;
  href?: string; accent: string; orb: string; delay: string;
  isNum?: boolean; prefix?: string;
}) {
  const count = useCountUp(isNum ? value : 0);
  const display = prefix
    ? `${prefix}${count.toLocaleString("en-IN")}`
    : count.toLocaleString("en-IN");

  const inner = (
    <div className={`stat-card glass-card anim-fade-up ${delay} group h-full`}>
      {/* Accent top bar */}
      <div className={`accent-bar bg-gradient-to-r ${accent}`} />

      {/* Background orb */}
      <div className="bg-orb w-32 h-32 -bottom-8 -right-8" style={{ background: `radial-gradient(circle, ${orb} 0%, transparent 70%)` }} />

      {/* Icon */}
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center text-xl shadow-lg mb-4`}>
        {icon}
      </div>

      {/* Value */}
      <div className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">
        {display}
      </div>

      {/* Label */}
      <div className="text-sm font-semibold text-slate-600 mb-2">{label}</div>

      {/* Sub */}
      {sub && <div className="text-xs text-slate-400 leading-relaxed">{sub}</div>}

      {/* View arrow */}
      {href && (
        <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
          View all <span className="transition-transform group-hover:translate-x-1 inline-block">→</span>
        </div>
      )}
    </div>
  );

  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [stats, setStats]   = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Analytics>("/admin/analytics")
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="anim-fade-in">

      {/* Header */}
      <div className="mb-8 anim-fade-up">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back — here&apos;s your platform at a glance.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-5 h-44">
              <div className="skeleton w-12 h-12 rounded-2xl mb-4" />
              <div className="skeleton h-8 w-24 mb-2" />
              <div className="skeleton h-4 w-32 mb-1" />
              <div className="skeleton h-3 w-full" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {CARDS(stats).map((c) => <StatCard key={c.label} {...c} />)}
          </div>

          {/* Second row */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {/* Subscription revenue */}
            <div className="glass-card rounded-2xl p-5 anim-fade-up anim-d5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-lg shadow-md">💳</div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subscription Revenue</div>
                  <Link href="/admin/subscriptions" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">Manage →</Link>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">₹{stats.subscription_revenue.toLocaleString("en-IN")}</div>
              <div className="text-xs text-slate-400 mt-1">From active plan subscriptions</div>
            </div>

            {/* Pending shops alert */}
            {stats.pending_shops > 0 ? (
              <Link href="/admin/shops?status=pending" className="col-span-1 md:col-span-2 block">
                <div className="h-full glass-card rounded-2xl p-5 border border-amber-300/60 bg-amber-50/70 anim-fade-up anim-d6 group hover:border-amber-400">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl border border-amber-200">⚠️</div>
                    <div>
                      <div className="font-bold text-amber-900">{stats.pending_shops} Shops Awaiting Approval</div>
                      <div className="text-xs text-amber-600">Review and approve or reject pending registrations</div>
                    </div>
                    <div className="ml-auto text-sm font-bold text-amber-700 group-hover:translate-x-1 transition-transform">→</div>
                  </div>
                  <div className="flex gap-2">
                    {["Registration review", "Set status", "Contact owner"].map((t) => (
                      <span key={t} className="text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="col-span-1 md:col-span-2 glass-card rounded-2xl p-5 anim-fade-up anim-d6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-2xl shadow-lg">✅</div>
                <div>
                  <div className="font-bold text-slate-900">All shops approved</div>
                  <div className="text-sm text-slate-500">No pending shop registrations.</div>
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="glass-card rounded-2xl p-5 anim-fade-up anim-d7">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Quick Actions</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: "/admin/shops",        label: "Approve Shops",  icon: "✅", gradient: "from-emerald-400 to-teal-500" },
                { href: "/admin/users",        label: "Manage Users",   icon: "👥", gradient: "from-blue-400 to-indigo-500" },
                { href: "/admin/subscriptions",label: "Edit Plans",     icon: "💳", gradient: "from-pink-400 to-rose-500" },
                { href: "/admin/static-pages", label: "Edit Pages",     icon: "📄", gradient: "from-violet-400 to-purple-500" },
              ].map((a) => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/50 hover:bg-white/80 border border-white/60 hover:border-emerald-200 transition-all group hover:-translate-y-0.5">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center text-base shadow-sm flex-shrink-0`}>
                    {a.icon}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500">Failed to load analytics.</div>
      )}
    </div>
  );
}
