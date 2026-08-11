"use client";
import { useEffect, useState } from "react";
import { api, User } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

const ROLE_STYLES: Record<string, string> = {
  customer:   "bg-blue-50 text-blue-700 border-blue-200",
  shopkeeper: "bg-purple-50 text-purple-700 border-purple-200",
  admin:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:    "bg-slate-50 text-slate-500 border-slate-200",
};

const ROLE_ICONS: Record<string, string> = {
  customer: "👤", shopkeeper: "🏪", admin: "⚡", pending: "⏳",
};

export default function UsersPage() {
  const [users, setUsers]   = useState<User[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState<string | null>(null);

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
    const roleMatch   = filter === "all" || u.role === filter;
    const searchMatch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    return roleMatch && searchMatch;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = { customer: 0, shopkeeper: 0, admin: 0, pending: 0 };
  users.forEach((u) => { if (u.role in counts) counts[u.role as keyof typeof counts]++; });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Users</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length.toLocaleString()} total registered users</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Customers",    count: counts.customer,   color: "blue",   icon: "👤" },
          { label: "Shopkeepers",  count: counts.shopkeeper, color: "purple", icon: "🏪" },
          { label: "Admins",       count: counts.admin,      color: "emerald",icon: "⚡" },
          { label: "Pending",      count: counts.pending,    color: "slate",  icon: "⏳" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-xl font-extrabold text-slate-900">{s.count.toLocaleString()}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="flex-1 h-10 px-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
        <div className="flex gap-2 flex-wrap">
          {["all","customer","shopkeeper","admin"].map((r) => (
            <button key={r} onClick={() => setFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${filter === r ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}>
              {r === "all" ? `All (${users.length})` : `${r} (${counts[r as keyof typeof counts]})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["User","Phone","Role","Status","Joined","Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                          {u.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="font-semibold text-slate-900 leading-tight">{u.name || <span className="text-slate-400 italic">No name</span>}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize flex items-center gap-1 w-fit ${ROLE_STYLES[u.role] ?? ""}`}>
                        {ROLE_ICONS[u.role]} {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.status === "banned"
                        ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">🚫 Banned</span>
                        : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">✓ Active</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {u.role !== "admin" && (
                        u.status === "banned"
                          ? <button onClick={() => activate(u.id)} disabled={busy === u.id} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 rounded-lg disabled:opacity-50 transition-colors">Activate</button>
                          : <button onClick={() => ban(u.id)}      disabled={busy === u.id} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold border border-red-200 rounded-lg disabled:opacity-50 transition-colors">Ban</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0
            ? <div className="py-12 text-center text-slate-400 text-sm">No users found.</div>
            : <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          }
        </div>
      )}
    </div>
  );
}
