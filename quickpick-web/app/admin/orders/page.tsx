"use client";
import { useEffect, useState } from "react";
import { api, Order } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  awaiting_payment: "bg-purple-50 text-purple-700 border-purple-200",
  packaging: "bg-amber-50 text-amber-700 border-amber-200",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-slate-50 text-slate-600 border-slate-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Placed",
  awaiting_payment: "Awaiting Payment",
  packaging: "Packaging",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async (status?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = status && status !== "all" ? { status } : {};
      const d = await api.get<{ orders: Order[] }>("/admin/orders", params);
      setOrders(d.orders);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(filter === "all" ? undefined : filter); }, [filter]);

  const FILTERS = ["all", "submitted", "awaiting_payment", "packaging", "ready", "completed", "cancelled"];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Orders</h1>
        <p className="text-slate-500 text-sm mt-1">Monitor all platform orders</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all ${filter === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}
          >
            {s === "all" ? "All" : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Loading orders…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Order", "Customer", "Shop", "Total", "Payment", "Status", "Date"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{o.customer_name}</div>
                      <div className="text-xs text-slate-400">{o.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{o.shop_name}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {o.total > 0 ? `₹${o.total.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize text-xs">
                      {o.payment_method} · <span className={o.payment_status === "paid" || o.payment_status === "online_paid" ? "text-emerald-600" : "text-amber-600"}>{o.payment_status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[o.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(o.created_at).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">No orders found.</div>
          )}
        </div>
      )}
    </div>
  );
}
