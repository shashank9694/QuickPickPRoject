"use client";
import { useEffect, useState } from "react";
import { api, Shop } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  approved:  { label: "Approved",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pending:   { label: "Pending",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
  suspended: { label: "Suspended", cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function ShopsPage() {
  const [shops, setShops]     = useState<Shop[]>([]);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);

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
    const sm = filter === "all" || s.status === filter;
    const qm = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.owner_phone ?? "").includes(search);
    return sm && qm;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = { pending: shops.filter(s => s.status === "pending").length, approved: shops.filter(s => s.status === "approved").length, suspended: shops.filter(s => s.status === "suspended").length };

  return (
    <div className="anim-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 anim-fade-up">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Shops</h1>
          <p className="text-slate-500 mt-1">{shops.length} registered · {counts.pending} pending approval</p>
        </div>
        <div className="flex gap-2">
          {[
            { status: "approved",  label: "Active",    color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
            { status: "pending",   label: "Pending",   color: "text-amber-700 bg-amber-50 border-amber-200" },
            { status: "suspended", label: "Suspended", color: "text-red-700 bg-red-50 border-red-200" },
          ].map(({ status, label, color }) => (
            <div key={status} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${color}`}>
              <span className="font-extrabold text-sm">{counts[status as keyof typeof counts]}</span> {label}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 anim-fade-up anim-d1">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shop name or owner phone…"
          className="glass-input flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          {["all","pending","approved","suspended"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all capitalize ${
                filter === s
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                  : "btn-ghost"
              }`}>
              {s === "all" ? `All (${shops.length})` : `${s.charAt(0).toUpperCase()+s.slice(1)} (${counts[s as keyof typeof counts] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-slate-500">Loading shops…</div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl py-16 text-center text-slate-400">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-semibold">No shops found</div>
          <div className="text-sm mt-1">Try a different filter or search term</div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden anim-fade-up anim-d2">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Shop", "Category", "Owner", "Status", "Open", "Actions"].map((h) => (
                    <th key={h} className="text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((shop) => {
                  const sc = STATUS_CFG[shop.status] ?? { label: shop.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                  return (
                    <tr key={shop.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-400/20 border border-emerald-100 flex items-center justify-center text-lg flex-shrink-0">🏪</div>
                          <div>
                            <div className="font-semibold text-slate-900">{shop.name}</div>
                            <div className="text-xs text-slate-400 font-mono">{shop.id.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="bg-slate-100/80 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg">{shop.category}</span>
                      </td>
                      <td className="text-slate-600 font-mono text-xs">{shop.owner_phone ?? "—"}</td>
                      <td>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${sc.cls}`}>{sc.label}</span>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${shop.is_open ? "text-emerald-600" : "text-slate-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${shop.is_open ? "bg-emerald-500" : "bg-slate-300"}`} />
                          {shop.is_open ? "Open" : "Closed"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {shop.status !== "approved" && (
                            <button onClick={() => approve(shop.id)} disabled={busy === shop.id}
                              className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
                              ✓ Approve
                            </button>
                          )}
                          {shop.status !== "suspended" && (
                            <button onClick={() => suspend(shop.id)} disabled={busy === shop.id}
                              className="btn-ghost text-xs py-1.5 px-3 !text-red-600 hover:!bg-red-50 hover:!border-red-200 disabled:opacity-50">
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-white/40">
            <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
