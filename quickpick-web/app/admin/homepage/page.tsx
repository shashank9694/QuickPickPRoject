"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Stat    = { value: string; label: string };
type Feature = { icon: string; title: string; desc: string };
type HP = {
  hero: { badge: string; title: string; title_highlight: string; subtitle: string; cta_primary: string; cta_secondary: string };
  stats: Stat[];
  features: Feature[];
  contact: { title: string; subtitle: string; email: string };
};

const DEFAULT: HP = {
  hero: { badge: "", title: "", title_highlight: "", subtitle: "", cta_primary: "", cta_secondary: "" },
  stats: [{ value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }],
  features: Array(6).fill(null).map(() => ({ icon: "", title: "", desc: "" })),
  contact: { title: "", subtitle: "", email: "" },
};

export default function HomepagePage() {
  const [data, setData]     = useState<HP>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<"hero"|"stats"|"features"|"contact">("hero");

  useEffect(() => {
    api.get<HP>("/homepage").then((d) => setData(d)).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await api.put("/admin/homepage", data);
      setMsg("✓ Homepage saved successfully!");
    } catch (e: any) { setMsg("✗ " + (e.message ?? "Failed")); }
    finally { setSaving(false); }
  };

  const setHero    = (k: keyof HP["hero"], v: string) => setData((p) => ({ ...p, hero: { ...p.hero, [k]: v } }));
  const setContact = (k: keyof HP["contact"], v: string) => setData((p) => ({ ...p, contact: { ...p.contact, [k]: v } }));
  const setStat    = (i: number, k: keyof Stat, v: string) => setData((p) => { const s = [...p.stats]; s[i] = { ...s[i], [k]: v }; return { ...p, stats: s }; });
  const setFeature = (i: number, k: keyof Feature, v: string) => setData((p) => { const f = [...p.features]; f[i] = { ...f[i], [k]: v }; return { ...p, features: f }; });

  const TABS = [
    { id: "hero" as const,     label: "Hero Section",  icon: "🏠" },
    { id: "stats" as const,    label: "Stats Bar",     icon: "📊" },
    { id: "features" as const, label: "Features",      icon: "✨" },
    { id: "contact" as const,  label: "Contact",       icon: "📧" },
  ];

  const inputCls = "w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white";
  const labelCls = "text-xs font-semibold text-slate-600 mb-1 block";

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Homepage Content</h1>
          <p className="text-slate-500 text-sm mt-1">Edit what visitors see on the landing page. Changes apply immediately after saving.</p>
        </div>
        <button onClick={save} disabled={saving}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm flex items-center gap-2">
          {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Saving…</> : "💾 Save Changes"}
        </button>
      </div>

      {msg && (
        <div className={`mb-5 p-3 rounded-xl text-sm font-medium border ${msg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{msg}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === t.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

        {/* HERO */}
        {tab === "hero" && (
          <div className="space-y-4">
            <h2 className="font-bold text-slate-800 mb-4">Hero Section</h2>
            <div><label className={labelCls}>Badge text (small pill above heading)</label><input className={inputCls} value={data.hero.badge} onChange={(e) => setHero("badge", e.target.value)} placeholder="Pre-order & Pickup Platform" /></div>
            <div><label className={labelCls}>Main heading (line 1)</label><input className={inputCls} value={data.hero.title} onChange={(e) => setHero("title", e.target.value)} placeholder="Skip the queue." /></div>
            <div><label className={labelCls}>Main heading (line 2, shown in green)</label><input className={inputCls} value={data.hero.title_highlight} onChange={(e) => setHero("title_highlight", e.target.value)} placeholder="Pick up what you need." /></div>
            <div><label className={labelCls}>Subtitle / description</label><textarea className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" rows={3} value={data.hero.subtitle} onChange={(e) => setHero("subtitle", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Primary CTA button text</label><input className={inputCls} value={data.hero.cta_primary} onChange={(e) => setHero("cta_primary", e.target.value)} /></div>
              <div><label className={labelCls}>Secondary CTA button text</label><input className={inputCls} value={data.hero.cta_secondary} onChange={(e) => setHero("cta_secondary", e.target.value)} /></div>
            </div>

            {/* Live preview */}
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Preview</div>
              <div className="text-center">
                <div className="inline-block bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 mb-3">{data.hero.badge || "Badge text"}</div>
                <div className="text-2xl font-extrabold text-slate-900">{data.hero.title || "Main heading"}</div>
                <div className="text-2xl font-extrabold text-emerald-600">{data.hero.title_highlight || "Highlighted line"}</div>
                <div className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">{data.hero.subtitle || "Subtitle text..."}</div>
              </div>
            </div>
          </div>
        )}

        {/* STATS */}
        {tab === "stats" && (
          <div>
            <h2 className="font-bold text-slate-800 mb-4">Stats Bar (3 numbers shown in green banner)</h2>
            <div className="grid grid-cols-3 gap-4">
              {data.stats.map((s, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div className="text-xs font-bold text-slate-500 mb-3">Stat {i + 1}</div>
                  <div><label className={labelCls}>Value</label><input className={inputCls} value={s.value} onChange={(e) => setStat(i, "value", e.target.value)} placeholder="0 min" /></div>
                  <div className="mt-3"><label className={labelCls}>Label</label><input className={inputCls} value={s.label} onChange={(e) => setStat(i, "label", e.target.value)} placeholder="Wait Time" /></div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-emerald-600 rounded-xl flex justify-around text-white text-center">
              {data.stats.map((s, i) => (
                <div key={i}><div className="text-xl font-extrabold">{s.value || "—"}</div><div className="text-emerald-100 text-xs">{s.label || "Label"}</div></div>
              ))}
            </div>
          </div>
        )}

        {/* FEATURES */}
        {tab === "features" && (
          <div>
            <h2 className="font-bold text-slate-800 mb-4">Features (6 cards shown in grid)</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {data.features.map((f, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div className="text-xs font-bold text-slate-500 mb-3">Feature {i + 1}</div>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div><label className={labelCls}>Icon</label><input className={inputCls} value={f.icon} onChange={(e) => setFeature(i, "icon", e.target.value)} placeholder="📱" /></div>
                    <div className="col-span-3"><label className={labelCls}>Title</label><input className={inputCls} value={f.title} onChange={(e) => setFeature(i, "title", e.target.value)} /></div>
                  </div>
                  <div><label className={labelCls}>Description</label><textarea className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white" rows={2} value={f.desc} onChange={(e) => setFeature(i, "desc", e.target.value)} /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTACT */}
        {tab === "contact" && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-bold text-slate-800 mb-4">Contact / Footer CTA Section</h2>
            <div><label className={labelCls}>Section title</label><input className={inputCls} value={data.contact.title} onChange={(e) => setContact("title", e.target.value)} placeholder="Ready to get started?" /></div>
            <div><label className={labelCls}>Subtitle</label><textarea className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" rows={2} value={data.contact.subtitle} onChange={(e) => setContact("subtitle", e.target.value)} /></div>
            <div><label className={labelCls}>Contact email</label><input className={inputCls} type="email" value={data.contact.email} onChange={(e) => setContact("email", e.target.value)} placeholder="hello@quickpick.in" /></div>
          </div>
        )}
      </div>
    </div>
  );
}
