"use client";
import { useEffect, useState } from "react";
import { api, Shop } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700 border-green-200",
  pending:  "bg-amber-50 text-amber-700 border-amber-200",
  suspended:"bg-red-50 text-red-700 border-red-200",
};

export default function ShopsPage() {
  const [shops, setShops]   = useState<Shop[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const d = await api.get<{ shops: Shop[] }>("/admin/shops"); setShops(d.shops); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [filter, search]);

  const approve = async (id: string) => { setBusy(id); try { await api.patch(`/admin/shops/${id}/approve`); await load(); } finally { setBusy(null); } };
  const suspend = async (id: string) => { setBusy(id); try { await api.patch(`/admin/shops/${id}/suspend`); await load(); } finally { setBusy(null); } };

  const filtered = shops.filter((s) => {
    const statusMatch = filter === "all" || s.status === filter;
    const searchMatch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.owner_phone ?? "").includes(search);
    return statusMatch && searchMatch;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Shops</h1>
          <p className="text-slate-500 text-sm mt-1">{shops.length} total · {shops.filter(s => s.status === "pending").length} pending approval</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <span>🏪</span><span className="font-semibold text-slate-700">{shops.filter(s => s.status === "approved").length}</span> active
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shop name or owner phone…"
          className="flex-1 h-10 px-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        <div className="flex gap-2 flex-wrap">
          {["all","pending","approved","suspended"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all capitalize ${filter === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}>
              {s === "all" ? `All (${shops.length})` : `${s.charAt(0).toUpperCase()+s.slice(1)} (${shops.filter(x=>x.status===s).length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-400 text-sm py-16 text-center bg-white rounded-2xl border border-slate-200">No shops found.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Shop","Category","Owner","Location","Status","Open","Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-base flex-shrink-0">🏪</div>
                        <div>
                          <div className="font-semibold text-slate-900 leading-tight">{shop.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{shop.id.slice(0,8)}…</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-lg">{shop.category}</span></td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{shop.owner_phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px] truncate">{shop.address}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${STATUS_STYLES[shop.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>{shop.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${shop.is_open ? "text-emerald-600" : "text-slate-400"}`}>{shop.is_open ? "Open" : "Closed"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {shop.status !== "approved" && (
                          <button onClick={() => approve(shop.id)} disabled={busy === shop.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap">
                            ✓ Approve
                          </button>
                        )}
                        {shop.status !== "suspended" && (
                          <button onClick={() => suspend(shop.id)} disabled={busy === shop.id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 text-xs font-bold border border-red-200 rounded-lg transition-colors whitespace-nowrap">
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
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
