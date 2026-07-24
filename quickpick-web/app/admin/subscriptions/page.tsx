"use client";
import { useEffect, useState } from "react";
import { api, Plan, Subscription } from "@/lib/api";

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [plansData, subsData] = await Promise.all([
      api.get<{ plans: Plan[] }>("/admin/plans").catch(() => ({ plans: [] })),
      api.get<{ subscriptions: Subscription[]; revenue: number }>("/admin/subscriptions").catch(() => ({ subscriptions: [], revenue: 0 })),
    ]);
    setPlans(plansData.plans);
    setSubs(subsData.subscriptions);
    setRevenue(subsData.revenue);
  };

  useEffect(() => { load(); }, []);

  const savePlan = async () => {
    if (!editPlan) return;
    setSaving(true); setMsg("");
    try {
      await api.put(`/admin/plans/${editPlan.code}`, {
        name: editPlan.name,
        price: editPlan.price,
        period_days: editPlan.period_days,
        max_orders_per_day: editPlan.max_orders_per_day,
        max_shops: editPlan.max_shops,
        features: editPlan.features,
      });
      setMsg("Plan saved successfully!");
      setEditPlan(null);
      await load();
    } catch (e: any) {
      setMsg(e.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Subscriptions</h1>
        <p className="text-slate-500 text-sm mt-1">
          {subs.length} active subscriptions · Total revenue: <strong className="text-slate-800">₹{revenue.toLocaleString("en-IN")}</strong>
        </p>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.includes("success") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      {/* Plans */}
      <h2 className="font-bold text-slate-800 mb-3">Subscription Plans</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {plans.map((plan) => (
          <div key={plan.code} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-extrabold text-slate-900">{plan.name}</div>
              <button
                onClick={() => setEditPlan({ ...plan })}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold border border-emerald-200 hover:border-emerald-400 px-2.5 py-1 rounded-lg transition-colors"
              >
                Edit
              </button>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mb-1">
              {plan.price === 0 ? "Free" : `₹${plan.price}`}
              {plan.price > 0 && <span className="text-sm font-normal text-slate-400">/{plan.period_days}d</span>}
            </div>
            <div className="text-xs text-slate-500 mb-3">{plan.max_shops} shop{plan.max_shops > 1 ? "s" : ""} · {plan.max_orders_per_day === 9999 ? "Unlimited" : plan.max_orders_per_day} orders/day</div>
            <ul className="space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-500">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editPlan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-lg">Edit Plan: {editPlan.name}</h3>
              <button onClick={() => setEditPlan(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { label: "Plan Name", key: "name", type: "text" },
                { label: "Price (₹/period)", key: "price", type: "number" },
                { label: "Period (days)", key: "period_days", type: "number" },
                { label: "Max Shops", key: "max_shops", type: "number" },
                { label: "Max Orders/day", key: "max_orders_per_day", type: "number" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(editPlan as any)[key]}
                    onChange={(e) => setEditPlan((p) => p ? { ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value } : p)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Features (one per line)</label>
              <textarea
                value={editPlan.features.join("\n")}
                onChange={(e) => setEditPlan((p) => p ? { ...p, features: e.target.value.split("\n").filter(Boolean) } : p)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditPlan(null)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={savePlan}
                disabled={saving}
                className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors"
              >
                {saving ? "Saving…" : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active subscriptions table */}
      <h2 className="font-bold text-slate-800 mb-3">Active Subscriptions</h2>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Shopkeeper", "Plan", "Amount Paid", "Started", "Expires", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.shopkeeper_phone ?? s.shopkeeper_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 capitalize">{s.plan.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">₹{s.amount_paid.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(s.started_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(s.expires_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${s.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {subs.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">No subscriptions yet.</div>}
        </div>
      </div>
    </div>
  );
}
