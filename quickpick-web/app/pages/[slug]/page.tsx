"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, StaticPage } from "@/lib/api";

export default function PublicPage({ params }: { params: { slug: string } }) {
  const [page, setPage] = useState<StaticPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<StaticPage>(`/static-pages/${params.slug}`)
      .then((d) => setPage(d))
      .catch(() => setErr("Page not found"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🛍️</span>
            <span className="font-extrabold text-emerald-600">QuickPick</span>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Back to home</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-xl w-2/3" />
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-1 bg-slate-100 rounded my-8" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-slate-100 rounded" style={{ width: `${90 - i * 5}%` }} />
            ))}
          </div>
        ) : err ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📄</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Page not found</h1>
            <p className="text-slate-500 mb-8">This page doesn&apos;t exist or hasn&apos;t been created yet.</p>
            <Link href="/" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors">
              Go home
            </Link>
          </div>
        ) : page ? (
          <>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3">{page.title}</h1>
            {page.updated_at && (
              <p className="text-sm text-slate-400 mb-8">
                Last updated: {new Date(page.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            <div className="h-px bg-slate-100 mb-8" />
            <div className="prose prose-slate max-w-none">
              {page.content.split("\n").filter(Boolean).map((para, i) => (
                <p key={i} className="text-slate-700 leading-relaxed mb-4">{para}</p>
              ))}
            </div>
          </>
        ) : null}
      </main>

      <footer className="border-t border-slate-100 py-6 mt-16">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap gap-6 justify-center">
          {["about", "terms", "privacy", "revenue"].map((s) => (
            <Link key={s} href={`/pages/${s}`} className={`text-sm capitalize hover:text-emerald-600 transition-colors ${s === params.slug ? "text-emerald-600 font-semibold" : "text-slate-500"}`}>
              {s === "revenue" ? "Revenue Model" : s}
            </Link>
          ))}
        </div>
        <p className="text-center text-slate-400 text-xs mt-4">© {new Date().getFullYear()} QuickPick</p>
      </footer>
    </div>
  );
}
