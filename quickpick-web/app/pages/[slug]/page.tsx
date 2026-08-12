"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, StaticPage } from "@/lib/api";
import QuickPickLogo from "@/components/QuickPickLogo";
import { renderMarkdown } from "@/lib/renderMarkdown";

const SLUG_LABELS: Record<string, string> = {
  about:   "About Us",
  terms:   "Terms of Service",
  privacy: "Privacy Policy",
  revenue: "Revenue Model",
};

export default function PublicPage({ params }: { params: { slug: string } }) {
  const [page, setPage]     = useState<StaticPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState("");

  useEffect(() => {
    api.get<StaticPage>(`/static-pages/${params.slug}`)
      .then((d) => setPage(d))
      .catch(() => setErr("Page not found"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <QuickPickLogo size={30} />
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-emerald-600 transition-colors font-medium">
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-24 mb-8" />
            <div className="h-10 bg-slate-100 rounded-xl w-2/3" />
            <div className="h-4 bg-slate-100 rounded w-1/4 mt-2" />
            <div className="h-px bg-slate-100 my-8" />
            {[90, 80, 95, 70, 85, 60].map((w, i) => (
              <div key={i} className="h-4 bg-slate-100 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">📄</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Page not found</h1>
            <p className="text-slate-500 mb-8">This page doesn&apos;t exist or hasn&apos;t been created yet.</p>
            <Link href="/" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors">
              Go home
            </Link>
          </div>
        )}

        {!loading && page && (
          <article>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
              <Link href="/" className="hover:text-emerald-600">Home</Link>
              <span>/</span>
              <span className="text-slate-600 font-medium">{SLUG_LABELS[params.slug] ?? page.title}</span>
            </div>

            {/* Title block */}
            <div className="mb-8">
              <h1 className="text-4xl font-extrabold text-slate-900 leading-tight mb-3">{page.title}</h1>
              {page.updated_at && (
                <p className="text-sm text-slate-400">
                  Last updated:{" "}
                  <time dateTime={page.updated_at}>
                    {new Date(page.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </time>
                </p>
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-emerald-200 via-slate-200 to-transparent mb-10" />

            {/* Rendered content */}
            <div className="prose-custom">
              {page.content
                ? renderMarkdown(page.content)
                : (
                  <div className="text-center py-12 text-slate-400">
                    <p>Content coming soon.</p>
                  </div>
                )
              }
            </div>
          </article>
        )}
      </main>

      {/* Footer nav */}
      <footer className="border-t border-slate-100 bg-slate-50 py-10 mt-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            {[
              { slug: "about",   label: "About Us" },
              { slug: "terms",   label: "Terms of Service" },
              { slug: "privacy", label: "Privacy Policy" },
              { slug: "revenue", label: "Revenue Model" },
            ].map(({ slug, label }) => (
              <Link
                key={slug}
                href={`/pages/${slug}`}
                className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors ${
                  slug === params.slug
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <p className="text-center text-slate-400 text-xs">© {new Date().getFullYear()} QuickPick. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
