"use client";
import { useEffect, useState } from "react";
import { api, Shop } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
};

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get<{ shops: Shop[] }>("/admin/shops");
      setShops(d.shops);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusy(id);
    try { await api.patch(`/admin/shops/${id}/approve`); await load(); } finally { setBusy(null); }
  };

  const suspend = async (id: string) => {
    setBusy(id);
    try { await api.patch(`/admin/shops/${id}/suspend`); await load(); } finally { setBusy(null); }
  };

  const filtered = filter === "all" ? shops : shops.filter((s) => s.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Shops</h1>
          <p className="text-slate-500 text-sm mt-1">{shops.length} total · {shops.filter(s => s.status === "pending").length} pending</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {["all", "pending", "approved", "suspended"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all capitalize ${filter === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}
          >
            {s === "all" ? `All (${shops.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${shops.filter(x => x.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Loading shops…</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-400 text-sm py-12 text-center bg-white rounded-2xl border border-slate-200">No shops found.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Shop", "Category", "Owner", "Location", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((shop, i) => (
                  <tr key={shop.id} className={`border-b border-slate-50 hover:bg-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{shop.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{shop.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{shop.category}</td>
                    <td className="px-4 py-3 text-slate-600">{shop.owner_phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px] truncate">{shop.address}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${STATUS_STYLES[shop.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {shop.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {shop.status !== "approved" && (
                          <button
                            onClick={() => approve(shop.id)}
                            disabled={busy === shop.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        {shop.status !== "suspended" && (
                          <button
                            onClick={() => suspend(shop.id)}
                            disabled={busy === shop.id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 text-xs font-bold border border-red-200 rounded-lg transition-colors"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
