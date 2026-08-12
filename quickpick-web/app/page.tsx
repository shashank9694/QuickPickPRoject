"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Plan, hasToken } from "@/lib/api";
import QuickPickLogo from "@/components/QuickPickLogo";

type Stat    = { value: string; label: string };
type Feature = { icon: string; title: string; desc: string };
type HP = {
  hero: { badge: string; title: string; title_highlight: string; subtitle: string; cta_primary: string; cta_secondary: string };
  stats: Stat[];
  features: Feature[];
  contact: { title: string; subtitle: string; email: string };
};

const DEFAULT_HP: HP = {
  hero: {
    badge: "Pre-order & Pickup Platform",
    title: "Skip the queue.",
    title_highlight: "Pick up what you need.",
    subtitle: "Pre-order from local shops. No waiting in line, no delivery fees, no surprises. Your order is ready when you arrive.",
    cta_primary: "How it works →",
    cta_secondary: "For Shopkeepers",
  },
  stats: [
    { value: "0 min", label: "Wait Time" },
    { value: "100%", label: "Contactless" },
    { value: "₹0", label: "Delivery Fee" },
  ],
  features: [
    { icon: "🎙️", title: "Voice your order", desc: "Speak your shopping list in Hindi or Hinglish — AI understands, transcribes, and adds every item to your cart instantly." },
    { icon: "📷", title: "Photo your list", desc: "Snap a photo of your handwritten shopping list. AI reads it and creates your order automatically, even in Hindi." },
    { icon: "🗺️", title: "Nearby shops", desc: "Automatically shows shops near your location. Browse by category and see what's open right now." },
    { icon: "🔐", title: "OTP pickup", desc: "Get a unique OTP when your order is ready. Show it at the counter — no cash, no confusion." },
    { icon: "💳", title: "Flexible payment", desc: "Pay online in full, or pay a 10% advance for COD orders. Your choice, every time." },
    { icon: "📊", title: "Real-time tracking", desc: "Track your order from placed → packed → ready in real time. No need to call the shop." },
    { icon: "🎤", title: "Voice your catalog", desc: "Shopkeepers: just speak your price list in Hindi. AI extracts every item name, price, unit and category for you." },
    { icon: "🖼️", title: "Photo your price board", desc: "Photograph your handwritten menu or price board. AI reads every product and builds your shop catalog in seconds." },
    { icon: "✅", title: "Shopkeeper control", desc: "Review each order, adjust unavailable items, set the final price, and mark ready — all from one screen." },
  ],
  contact: { title: "Ready to get started?", subtitle: "Download the app and start ordering, or register your shop today.", email: "hello@quickpick.in" },
};

const NAV = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

export default function LandingPage() {
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [hp, setHp]               = useState<HP>(DEFAULT_HP);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [loggedIn, setLoggedIn]   = useState(false);
  const [scrolled, setScrolled]   = useState(false);

  useEffect(() => {
    setLoggedIn(hasToken());
    api.get<{ plans: Plan[] }>("/subscription/plans").then((d) => setPlans(d.plans)).catch(() => {});
    api.get<HP>("/homepage").then((d) => setHp(d)).catch(() => {});
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen text-slate-900 relative overflow-hidden" style={{ background: "linear-gradient(160deg,#f0fdf4 0%,#ffffff 40%,#f0f9ff 100%)" }}>

      {/* Decorative blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="blob blob-1 float-slow" style={{ top: "-100px", right: "-100px", width: "600px", height: "600px", background: "radial-gradient(circle,rgba(52,211,153,0.13) 0%,transparent 70%)" }} />
        <div className="blob float-reverse" style={{ bottom: "10%", left: "-100px", width: "400px", height: "400px", background: "radial-gradient(circle,rgba(56,189,248,0.08) 0%,transparent 70%)" }} />
        <div className="blob float-med" style={{ top: "40%", right: "10%", width: "300px", height: "300px", background: "radial-gradient(circle,rgba(16,185,129,0.07) 0%,transparent 70%)" }} />
      </div>

      {/* Session banner */}
      {loggedIn && (
        <div className="relative z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm py-2.5 text-center">
          <span className="opacity-90">You&apos;re logged in as admin.</span>{" "}
          <Link href="/admin/dashboard" className="font-bold underline underline-offset-2 hover:opacity-80">Go to Dashboard →</Link>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "glass shadow-lg shadow-emerald-900/5 border-b border-white/60" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <QuickPickLogo size={36} />

          <div className="hidden md:flex items-center gap-8">
            {NAV.map((n) => (
              <a key={n.label} href={n.href}
                className="text-slate-600 hover:text-emerald-600 font-medium transition-colors text-sm relative group">
                {n.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 rounded-full transition-all group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {loggedIn ? (
              <Link href="/admin/dashboard"
                className="hidden sm:flex items-center gap-1.5 btn-primary rounded-full px-5 py-2 text-sm">
                Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-emerald-700 transition-colors">
                  Admin Login
                </Link>
                <a href="#pricing" className="btn-primary rounded-full px-5 py-2 text-sm">
                  Get Started
                </a>
              </>
            )}
            <button className="md:hidden p-2 hover:bg-emerald-50 rounded-xl transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
              <div className={`w-5 h-0.5 bg-slate-700 transition-all duration-200 mb-1.5 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
              <div className={`w-5 h-0.5 bg-slate-700 transition-all duration-200 mb-1.5 ${menuOpen ? "opacity-0" : ""}`} />
              <div className={`w-5 h-0.5 bg-slate-700 transition-all duration-200 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden glass border-t border-white/50 px-4 py-4 flex flex-col gap-2 anim-fade-up">
            {NAV.map((n) => <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} className="text-slate-700 font-medium py-2 px-3 rounded-xl hover:bg-emerald-50">{n.label}</a>)}
            {loggedIn
              ? <Link href="/admin/dashboard" className="text-emerald-700 font-semibold py-2 px-3">Dashboard →</Link>
              : <Link href="/login" className="text-slate-700 font-medium py-2 px-3 rounded-xl hover:bg-emerald-50">Admin Login</Link>
            }
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 glass border border-emerald-200/60 text-emerald-700 text-xs font-bold px-4 py-2 rounded-full mb-8 anim-fade-up shadow-sm">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          {hp.hero.badge}
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-tight mb-6 anim-fade-up anim-d1">
          {hp.hero.title}<br />
          <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            {hp.hero.title_highlight}
          </span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed anim-fade-up anim-d2">
          {hp.hero.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center anim-fade-up anim-d3">
          <a href="#how" className="btn-primary rounded-full px-8 py-4 text-lg shadow-xl shadow-emerald-200 hover:shadow-emerald-300">
            {hp.hero.cta_primary}
          </a>
          <a href="#pricing"
            className="glass border border-white/60 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 font-bold px-8 py-4 rounded-full text-lg transition-all hover:-translate-y-0.5 hover:shadow-lg">
            {hp.hero.cta_secondary}
          </a>
        </div>

        {/* Pill tags */}
        <div className="mt-14 flex justify-center gap-3 flex-wrap anim-fade-up anim-d4">
          {["🛒 Browse shops", "📲 Place order", "✅ Track status", "🔐 Pickup OTP"].map((s, i) => (
            <div key={s} className={`glass border border-white/60 rounded-full px-4 py-2 text-sm text-slate-600 font-medium shadow-sm anim-fade-up anim-d${i + 4}`}>
              {s}
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 mb-20">
        <div className="glass rounded-3xl border border-white/60 shadow-xl shadow-emerald-900/5 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 py-10 px-4 grid grid-cols-3 gap-4 text-center text-white">
            {hp.stats.map((s, i) => (
              <div key={s.label} className={`anim-fade-up anim-d${i + 1}`}>
                <div className="text-3xl md:text-4xl font-extrabold">{s.value}</div>
                <div className="text-emerald-100 text-sm mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <div className="inline-block text-emerald-600 font-bold text-xs uppercase tracking-widest mb-3 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full">Features</div>
          <h2 className="text-4xl font-extrabold mb-4">Everything you need — now with AI</h2>
          <p className="text-slate-500 max-w-xl mx-auto">Voice and photo ordering for customers. Voice and photo catalog setup for shopkeepers. Built in, no extra steps.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {hp.features.map((f, i) => (
            <div key={f.title}
              className={`glass-card rounded-2xl p-6 anim-fade-up anim-d${Math.min(i + 1, 8)} group`}>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="relative z-10 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-block text-emerald-600 font-bold text-xs uppercase tracking-widest mb-3 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full">Process</div>
            <h2 className="text-4xl font-extrabold mb-4">How it works</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "For Customers", color: "from-emerald-500 to-teal-500",
                steps: [
                  ["Browse & Order", "Open the app, find a nearby shop, add items and place your pre-order in under a minute."],
                  ["Pay & Track", "Pay online or a small advance for COD. Track your order status in real-time."],
                  ["Show OTP & Pickup", "When your order is ready, head to the shop and show your OTP to collect it."],
                ],
              },
              {
                title: "For Shopkeepers", color: "from-slate-600 to-slate-800",
                steps: [
                  ["Review & Price", "See incoming orders, mark unavailable items, and set prices per item."],
                  ["Pack & Ready", "After payment is received, pack the order and mark it ready for pickup."],
                  ["Verify OTP", "Customer shows their OTP at your counter. Enter it to complete the order."],
                ],
              },
            ].map((side) => (
              <div key={side.title} className="glass-card rounded-2xl p-7">
                <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${side.color} text-white text-xs font-bold px-4 py-1.5 rounded-full mb-6`}>
                  {side.title}
                </div>
                <div className="space-y-5">
                  {side.steps.map(([title, desc], i) => (
                    <div key={title} className="flex gap-4">
                      <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${side.color} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md`}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-bold mb-1 text-slate-900">{title}</div>
                        <div className="text-slate-500 text-sm leading-relaxed">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <div className="inline-block text-emerald-600 font-bold text-xs uppercase tracking-widest mb-3 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full">Pricing</div>
          <h2 className="text-4xl font-extrabold mb-4">Simple pricing for shopkeepers</h2>
          <p className="text-slate-500">Start with a free 14-day trial. No credit card required.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center border-2 border-dashed border-emerald-300/70 order-last md:order-first">
            <div className="text-4xl mb-3">🎁</div>
            <div className="font-extrabold text-lg mb-1">Free Trial</div>
            <div className="text-3xl font-extrabold text-emerald-600 mb-1">₹0</div>
            <div className="text-slate-500 text-sm mb-5">All Pro features free for 14 days.</div>
            <a href="#" className="btn-primary rounded-full px-6 py-2 w-full text-center text-sm justify-center">Start Free Trial</a>
          </div>
          {plans.filter(p => p.code !== "free_trial").map((plan, i) => (
            <div key={plan.code}
              className={`glass-card rounded-2xl p-6 flex flex-col transition-all anim-fade-up anim-d${i + 1} ${i === 1 ? "ring-2 ring-emerald-400 ring-offset-2" : ""}`}>
              {i === 1 && <div className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full self-start mb-4 uppercase tracking-widest">⭐ Popular</div>}
              <div className="font-extrabold text-lg mb-1 text-slate-900">{plan.name}</div>
              <div className="text-3xl font-extrabold mb-1">₹{plan.price}<span className="text-base font-normal text-slate-400">/mo</span></div>
              <div className="text-sm text-slate-500 mb-5">Up to {plan.max_shops} shop{plan.max_shops > 1 ? "s" : ""} · {plan.max_orders_per_day} orders/day</div>
              <ul className="flex flex-col gap-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0 font-bold">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${i === 1 ? "btn-primary justify-center" : "btn-ghost"}`}>
                Get started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="relative z-10 py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="glass rounded-3xl border border-white/60 shadow-2xl shadow-emerald-900/10 overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-8 py-16 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)" }} />
              <div className="relative">
                <div className="text-emerald-200 font-bold text-xs uppercase tracking-widest mb-4">Get Started</div>
                <h2 className="text-4xl font-extrabold text-white mb-4">{hp.contact.title}</h2>
                <p className="text-emerald-100 mb-8 text-lg">{hp.contact.subtitle}</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a href="#" className="glass rounded-full px-8 py-3 text-white font-bold hover:bg-white/20 transition-all">📱 Download App</a>
                  <a href="#pricing" className="bg-white/15 backdrop-blur border border-white/30 hover:bg-white/25 text-white font-bold px-8 py-3 rounded-full transition-all">🏪 Register Shop</a>
                </div>
                <p className="text-emerald-200/80 text-sm mt-8">
                  Questions? <a href={`mailto:${hp.contact.email}`} className="text-white underline hover:no-underline">{hp.contact.email}</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-slate-100/80 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <QuickPickLogo size={28} />
          <div className="flex gap-6 text-sm text-slate-500 flex-wrap justify-center">
            {["about","terms","privacy","revenue"].map((slug) => (
              <a key={slug} href={`/pages/${slug}`} className="hover:text-emerald-600 transition-colors capitalize">
                {slug === "revenue" ? "Revenue Model" : slug}
              </a>
            ))}
          </div>
          <div className="text-sm text-slate-400">© {new Date().getFullYear()} QuickPick</div>
        </div>
      </footer>
    </div>
  );
}
