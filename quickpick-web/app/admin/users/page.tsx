"use client";
import { useEffect, useState } from "react";
import { api, User } from "@/lib/api";

const ROLE_STYLES: Record<string, string> = {
  customer: "bg-blue-50 text-blue-700 border-blue-200",
  shopkeeper: "bg-purple-50 text-purple-700 border-purple-200",
  admin: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get<{ users: User[] }>("/admin/users");
      setUsers(d.users);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ban = async (id: string) => {
    setBusy(id);
    try { await api.patch(`/admin/users/${id}/ban`); await load(); } finally { setBusy(null); }
  };

  const activate = async (id: string) => {
    setBusy(id);
    try { await api.patch(`/admin/users/${id}/activate`); await load(); } finally { setBusy(null); }
  };

  const filtered = users.filter((u) => {
    const roleMatch = filter === "all" || u.role === filter;
    const searchMatch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    return roleMatch && searchMatch;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Users</h1>
        <p className="text-slate-500 text-sm mt-1">{users.length} total users</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="flex-1 h-10 px-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        <div className="flex gap-2">
          {["all", "customer", "shopkeeper", "admin"].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${filter === r ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Loading users…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["User", "Phone", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                          {u.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="font-semibold text-slate-900">{u.name || "—"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${ROLE_STYLES[u.role] ?? ""}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      {u.status === "banned"
                        ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">Banned</span>
                        : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {u.role !== "admin" && (
                        u.status === "banned"
                          ? <button onClick={() => activate(u.id)} disabled={busy === u.id} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 rounded-lg disabled:opacity-50">Activate</button>
                          : <button onClick={() => ban(u.id)} disabled={busy === u.id} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold border border-red-200 rounded-lg disabled:opacity-50">Ban</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">No users found.</div>
          )}
        </div>
      )}
    </div>
  );
}
