"use client";
import { useEffect, useState } from "react";
import { api, User } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

const ROLE_CFG: Record<string, { cls: string; icon: string; gradient: string }> = {
  customer:   { cls: "bg-blue-100 text-blue-700 border-blue-200",     icon: "👤", gradient: "from-blue-400 to-indigo-500" },
  shopkeeper: { cls: "bg-violet-100 text-violet-700 border-violet-200",icon: "🏪", gradient: "from-violet-400 to-purple-500" },
  admin:      { cls: "bg-emerald-100 text-emerald-700 border-emerald-200",icon: "⚡", gradient: "from-emerald-400 to-teal-500" },
  pending:    { cls: "bg-slate-100 text-slate-500 border-slate-200",   icon: "⏳", gradient: "from-slate-300 to-slate-400" },
};

export default function UsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const d = await api.get<{ users: User[] }>("/admin/users"); setUsers(d.users); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [filter, search]);

  const ban      = async (id: string) => { setBusy(id); try { await api.patch(`/admin/users/${id}/ban`);      await load(); } finally { setBusy(null); } };
  const activate = async (id: string) => { setBusy(id); try { await api.patch(`/admin/users/${id}/activate`); await load(); } finally { setBusy(null); } };

  const filtered = users.filter((u) => {
    const rm = filter === "all" || u.role === filter;
    const qm = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    return rm && qm;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const counts = { customer: 0, shopkeeper: 0, admin: 0, pending: 0 };
  users.forEach((u) => { if (u.role in counts) counts[u.role as keyof typeof counts]++; });

  const statCards = [
    { label: "Customers",   count: counts.customer,   key: "customer",   gradient: "from-blue-400 to-indigo-500",    icon: "👤" },
    { label: "Shopkeepers", count: counts.shopkeeper, key: "shopkeeper", gradient: "from-violet-400 to-purple-500",  icon: "🏪" },
    { label: "Admins",      count: counts.admin,      key: "admin",      gradient: "from-emerald-400 to-teal-500",   icon: "⚡" },
    { label: "Pending",     count: counts.pending,    key: "pending",    gradient: "from-slate-400 to-slate-500",    icon: "⏳" },
  ];

  return (
    <div className="anim-fade-in">

      {/* Header */}
      <div className="mb-6 anim-fade-up">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Users</h1>
        <p className="text-slate-500 mt-1">{users.length.toLocaleString()} total registered users</p>
      </div>

      {/* Stat mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? "all" : s.key)}
            className={`glass-card rounded-2xl p-4 text-left flex items-center gap-3 anim-fade-up anim-d${i + 1} transition-all ${filter === s.key ? "ring-2 ring-emerald-400 ring-offset-2" : ""}`}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-lg shadow-md flex-shrink-0`}>
              {s.icon}
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{s.count.toLocaleString()}</div>
              <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 anim-fade-up anim-d5">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="glass-input flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${filter === "all" ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" : "btn-ghost"}`}>
            All ({users.length})
          </button>
          {(["customer", "shopkeeper", "admin"] as const).map((r) => (
            <button key={r} onClick={() => setFilter(r)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border capitalize transition-all ${filter === r ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" : "btn-ghost"}`}>
              {r} ({counts[r]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-slate-500">Loading users…</div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden anim-fade-up anim-d6">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  {["User", "Phone", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((u) => {
                  const cfg = ROLE_CFG[u.role] ?? ROLE_CFG.pending;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm`}>
                            {u.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="font-semibold text-slate-900">
                            {u.name || <span className="text-slate-400 italic text-sm">No name</span>}
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600 font-mono text-xs">{u.phone}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${cfg.cls}`}>
                          {cfg.icon} {u.role}
                        </span>
                      </td>
                      <td>
                        {u.status === "banned"
                          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">🚫 Banned</span>
                          : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">✓ Active</span>
                        }
                      </td>
                      <td className="text-slate-400 text-xs whitespace-nowrap">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td>
                        {u.role !== "admin" && (
                          u.status === "banned"
                            ? <button onClick={() => activate(u.id)} disabled={busy === u.id}
                                className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">Activate</button>
                            : <button onClick={() => ban(u.id)} disabled={busy === u.id}
                                className="btn-ghost text-xs py-1.5 px-3 !text-red-600 hover:!bg-red-50 hover:!border-red-200 disabled:opacity-50">Ban</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0
            ? <div className="py-12 text-center text-slate-400 text-sm">No users found.</div>
            : <div className="border-t border-white/40">
                <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>
          }
        </div>
      )}
    </div>
  );
}
