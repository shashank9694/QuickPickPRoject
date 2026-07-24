"use client";
import { useEffect, useState } from "react";
import { api, StaticPage } from "@/lib/api";

const PAGE_INFO: Record<string, { icon: string; desc: string }> = {
  about: { icon: "ℹ️", desc: "About QuickPick — shown in footer and About page" },
  terms: { icon: "📋", desc: "Terms of Service — legal terms for all users" },
  privacy: { icon: "🔒", desc: "Privacy Policy — how we handle user data" },
  revenue: { icon: "💰", desc: "Revenue Model — how QuickPick earns money" },
};

export default function StaticPagesPage() {
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [editing, setEditing] = useState<StaticPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get<{ pages: StaticPage[] }>("/admin/static-pages");
      setPages(d.pages);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true); setMsg("");
    try {
      await api.put(`/admin/static-pages/${editing.slug}`, { title: editing.title, content: editing.content });
      setMsg("Page saved!");
      setEditing(null);
      await load();
    } catch (e: any) {
      setMsg(e.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Static Pages</h1>
        <p className="text-slate-500 text-sm mt-1">Manage content for About, Terms, Privacy and Revenue pages.</p>
      </div>

      {msg && !editing && (
        <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{msg}</div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Loading…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {pages.map((page) => {
            const info = PAGE_INFO[page.slug] ?? { icon: "📄", desc: "" };
            return (
              <div key={page.slug} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{info.icon}</span>
                    <div>
                      <div className="font-bold text-slate-900">{page.title}</div>
                      <div className="text-xs text-slate-400 font-mono">/{page.slug}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing({ ...page })}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold border border-emerald-200 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </div>
                {info.desc && <p className="text-xs text-slate-500 mb-3">{info.desc}</p>}
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {page.content}
                </div>
                {page.updated_at && (
                  <div className="text-xs text-slate-400 mt-2">
                    Last updated: {new Date(page.updated_at).toLocaleDateString("en-IN")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-lg">Edit: {editing.title}</h3>
              <button onClick={() => { setEditing(null); setMsg(""); }} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>

            {msg && <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.includes("saved") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg}</div>}

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Page Title</label>
              <input
                value={editing.title}
                onChange={(e) => setEditing((p) => p ? { ...p, title: e.target.value } : p)}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Content</label>
              <textarea
                value={editing.content}
                onChange={(e) => setEditing((p) => p ? { ...p, content: e.target.value } : p)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y font-mono leading-relaxed"
                placeholder="Write the page content here…"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setEditing(null); setMsg(""); }} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors"
              >
                {saving ? "Saving…" : "Save Page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
