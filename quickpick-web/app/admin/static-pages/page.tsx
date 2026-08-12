"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, StaticPage } from "@/lib/api";
import { renderMarkdown } from "@/lib/renderMarkdown";

const PAGE_INFO: Record<string, { icon: string; desc: string }> = {
  about:   { icon: "ℹ️",  desc: "About QuickPick — shown in footer and About page" },
  terms:   { icon: "📋", desc: "Terms of Service — legal terms for all users" },
  privacy: { icon: "🔒", desc: "Privacy Policy — how we handle user data" },
  revenue: { icon: "💰", desc: "Revenue Model — how QuickPick earns money" },
};

const GUIDE = [
  ["# Heading 1",   "Large section title"],
  ["## Heading 2",  "Medium sub-section"],
  ["### Heading 3", "Small sub-heading"],
  ["**bold**",      "Bold text"],
  ["*italic*",      "Italic text"],
  ["`code`",        "Inline code"],
  ["- item",        "Bullet list item"],
  ["---",           "Horizontal divider"],
];

export default function StaticPagesPage() {
  const [pages, setPages]   = useState<StaticPage[]>([]);
  const [editing, setEditing] = useState<StaticPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");
  const [loading, setLoading] = useState(true);
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get<{ pages: StaticPage[] }>("/admin/static-pages");
      setPages(d.pages);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (page: StaticPage) => {
    setEditing({ ...page });
    setEditorTab("edit");
    setMsg("");
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true); setMsg("");
    try {
      await api.put(`/admin/static-pages/${editing.slug}`, { title: editing.title, content: editing.content });
      setMsg("✓ Page saved!");
      setEditing(null);
      await load();
    } catch (e: any) {
      setMsg("✗ " + (e.message ?? "Failed to save"));
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Static Pages</h1>
        <p className="text-slate-500 text-sm mt-1">Manage content for About, Terms, Privacy and Revenue pages. Supports Markdown formatting.</p>
      </div>

      {msg && !editing && (
        <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{msg}</div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
              <div className="h-5 bg-slate-100 rounded w-1/2 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {pages.map((page) => {
            const info = PAGE_INFO[page.slug] ?? { icon: "📄", desc: "" };
            const preview = page.content?.trim().split("\n").filter(Boolean)[0] ?? "";
            return (
              <div key={page.slug} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">{info.icon}</div>
                    <div>
                      <div className="font-bold text-slate-900">{page.title}</div>
                      <div className="text-xs text-slate-400 font-mono">/pages/{page.slug}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/pages/${page.slug}`}
                      target="_blank"
                      className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      View ↗
                    </Link>
                    <button
                      onClick={() => openEdit(page)}
                      className="text-xs text-emerald-700 hover:text-white font-semibold bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {info.desc && <p className="text-xs text-slate-400 mb-3">{info.desc}</p>}

                <div className="flex-1 bg-slate-50 rounded-xl p-3 text-xs text-slate-500 leading-relaxed min-h-[60px]">
                  {preview
                    ? <span className="text-slate-600">{preview.replace(/^[#*\-]+\s*/, "")}</span>
                    : <span className="italic text-slate-400">No content yet — click Edit to add content.</span>
                  }
                </div>

                {page.updated_at && (
                  <div className="text-xs text-slate-400 mt-3">
                    Updated {new Date(page.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Edit: {editing.title}</h3>
                <div className="text-xs text-slate-400 font-mono">/pages/{editing.slug}</div>
              </div>
              <button onClick={() => { setEditing(null); setMsg(""); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-lg">✕</button>
            </div>

            {msg && (
              <div className={`mx-6 mt-4 p-3 rounded-xl text-sm font-medium border ${msg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{msg}</div>
            )}

            <div className="p-6 space-y-4">
              {/* Page title */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Page Title</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing((p) => p ? { ...p, title: e.target.value } : p)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Content with Edit/Preview tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600">Content</label>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                    {(["edit", "preview"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setEditorTab(t)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${editorTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        {t === "edit" ? "✏️ Edit" : "👁 Preview"}
                      </button>
                    ))}
                  </div>
                </div>

                {editorTab === "edit" ? (
                  <textarea
                    value={editing.content}
                    onChange={(e) => setEditing((p) => p ? { ...p, content: e.target.value } : p)}
                    rows={16}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y font-mono leading-relaxed bg-slate-50"
                    placeholder={"# About QuickPick\n\nWrite your page content here using Markdown.\n\n## Section\n\nParagraph text goes here.\n\n- Bullet point one\n- Bullet point two"}
                  />
                ) : (
                  <div className="border border-slate-200 rounded-xl p-5 min-h-[320px] bg-white overflow-y-auto">
                    {editing.content?.trim()
                      ? <div className="prose-custom">{renderMarkdown(editing.content)}</div>
                      : <p className="text-slate-400 italic text-sm">Nothing to preview yet. Switch to Edit and add some content.</p>
                    }
                  </div>
                )}
              </div>

              {/* Markdown cheatsheet */}
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700 select-none">
                  📖 Markdown formatting guide
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-1 bg-slate-50 rounded-xl p-3">
                  {GUIDE.map(([syntax, label]) => (
                    <div key={syntax} className="flex items-center gap-2">
                      <code className="bg-white border border-slate-200 px-2 py-0.5 rounded font-mono text-emerald-700">{syntax}</code>
                      <span className="text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => { setEditing(null); setMsg(""); }}
                className="flex-1 h-11 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors"
              >
                {saving ? "Saving…" : "💾 Save Page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
