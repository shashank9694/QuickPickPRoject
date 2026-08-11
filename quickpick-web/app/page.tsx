"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Plan } from "@/lib/api";

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
    { icon: "📱", title: "Order from your phone", desc: "Browse nearby shops, add items, and place your order in seconds. No account required for browsing." },
    { icon: "✅", title: "Shopkeeper confirms", desc: "The shopkeeper reviews your items, marks what's available, and sets the final price — no surprises." },
    { icon: "🔐", title: "OTP pickup", desc: "Get a unique OTP when your order is ready. Show it at the counter to collect your order instantly." },
    { icon: "💳", title: "Flexible payment", desc: "Pay online in full, or pay a 10% advance for COD orders and settle the rest at pickup." },
    { icon: "🗺️", title: "Nearby shops", desc: "Automatically shows shops near your location. Filter by category to find exactly what you need." },
    { icon: "📊", title: "Real-time tracking", desc: "Track your order status from placed → packed → ready. Get live updates without refreshing." },
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hp, setHp]       = useState<HP>(DEFAULT_HP);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get<{ plans: Plan[] }>("/subscription/plans").then((d) => setPlans(d.plans)).catch(() => {});
    api.get<HP>("/homepage").then((d) => setHp(d)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-md">QP</div>
            <span className="font-extrabold text-xl text-emerald-600">QuickPick</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="text-slate-600 hover:text-emerald-600 font-medium transition-colors text-sm">{n.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-emerald-700 transition-colors">Admin Login</Link>
            <a href="#pricing" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2 rounded-full transition-colors shadow-md shadow-emerald-100">Get Started</a>
            <button className="md:hidden p-2 hover:bg-slate-100 rounded-lg" onClick={() => setMenuOpen(!menuOpen)}>
              <div className={`w-5 h-0.5 bg-slate-600 transition-all mb-1 ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <div className={`w-5 h-0.5 bg-slate-600 transition-all mb-1 ${menuOpen ? "opacity-0" : ""}`} />
              <div className={`w-5 h-0.5 bg-slate-600 transition-all ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 flex flex-col gap-3">
            {NAV.map((n) => <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} className="text-slate-700 font-medium py-1">{n.label}</a>)}
            <Link href="/login" className="text-slate-700 font-medium py-1">Admin Login</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full mb-8 tracking-widest uppercase border border-emerald-200">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          {hp.hero.badge}
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
          {hp.hero.title}<br />
          <span className="text-emerald-600">{hp.hero.title_highlight}</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">{hp.hero.subtitle}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#how" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-full text-lg transition-all shadow-xl shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5">
            {hp.hero.cta_primary}
          </a>
          <a href="#pricing" className="border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 font-bold px-8 py-4 rounded-full text-lg transition-all">
            {hp.hero.cta_secondary}
          </a>
        </div>

        {/* App mockup hint */}
        <div className="mt-16 flex justify-center gap-4 flex-wrap">
          {["🛒 Browse shops", "📲 Place order", "✅ Track status", "🔐 Pickup OTP"].map((s) => (
            <div key={s} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-600 font-medium">{s}</div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gradient-to-r from-emerald-600 to-emerald-500 py-12">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-8 text-center text-white">
          {hp.stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl md:text-4xl font-extrabold">{s.value}</div>
              <div className="text-emerald-100 text-sm mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <div className="text-emerald-600 font-bold text-sm uppercase tracking-widest mb-3">Features</div>
          <h2 className="text-4xl font-extrabold mb-4">Everything you need</h2>
          <p className="text-slate-500 max-w-xl mx-auto">Built for speed, simplicity, and reliability at scale.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {hp.features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-300 hover:shadow-lg hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:bg-emerald-100 transition-colors">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-slate-50 py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="text-emerald-600 font-bold text-sm uppercase tracking-widest mb-3">Process</div>
            <h2 className="text-4xl font-extrabold mb-4">How it works</h2>
            <p className="text-slate-500">Three simple steps for customers. Three simple steps for shopkeepers.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
              <div className="font-bold text-emerald-600 text-sm uppercase tracking-widest mb-6 flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full" />For Customers</div>
              {[
                ["1","Browse & Order","Open the app, find a nearby shop, add items and place your pre-order in under a minute."],
                ["2","Pay & Track","Pay online or a small advance for COD. Track your order status in real-time."],
                ["3","Show OTP & Pickup","When your order is ready, head to the shop and show your OTP to collect it."],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-4 mb-6 last:mb-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md shadow-emerald-200">{num}</div>
                  <div><div className="font-bold mb-1 text-slate-900">{title}</div><div className="text-slate-500 text-sm leading-relaxed">{desc}</div></div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
              <div className="font-bold text-slate-700 text-sm uppercase tracking-widest mb-6 flex items-center gap-2"><span className="w-2 h-2 bg-slate-600 rounded-full" />For Shopkeepers</div>
              {[
                ["1","Review & Price","See incoming orders, mark unavailable items, and set prices per item. Total is auto-calculated."],
                ["2","Pack & Ready","After payment is received, pack the order and mark it ready for pickup."],
                ["3","Verify OTP","Customer shows their OTP at your counter. Enter it to complete the order."],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-4 mb-6 last:mb-0">
                  <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{num}</div>
                  <div><div className="font-bold mb-1 text-slate-900">{title}</div><div className="text-slate-500 text-sm leading-relaxed">{desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <div className="text-emerald-600 font-bold text-sm uppercase tracking-widest mb-3">Pricing</div>
          <h2 className="text-4xl font-extrabold mb-4">Simple pricing for shopkeepers</h2>
          <p className="text-slate-500">Start with a free 14-day trial. No credit card required.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {/* Free trial card */}
          <div className="rounded-2xl p-6 border-2 border-dashed border-emerald-300 bg-emerald-50/50 flex flex-col items-center justify-center text-center order-last md:order-first">
            <div className="text-4xl mb-3">🎁</div>
            <div className="font-extrabold text-lg mb-1">Free Trial</div>
            <div className="text-3xl font-extrabold text-emerald-600 mb-1">₹0</div>
            <div className="text-slate-500 text-sm mb-5">All Pro features free for 14 days. No payment needed.</div>
            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-full text-sm transition-colors">Start Free Trial</button>
          </div>
          {plans.filter(p => p.code !== "free_trial").map((plan, i) => (
            <div key={plan.code} className={`rounded-2xl p-6 border-2 flex flex-col transition-all hover:-translate-y-1 hover:shadow-lg ${i === 1 ? "border-emerald-500 bg-gradient-to-b from-emerald-50 to-white shadow-md" : "border-slate-200 bg-white"}`}>
              {i === 1 && <div className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full self-start mb-4 uppercase tracking-widest">⭐ Popular</div>}
              <div className="font-extrabold text-lg mb-1 text-slate-900">{plan.name}</div>
              <div className="text-3xl font-extrabold mb-1">₹{plan.price}<span className="text-base font-normal text-slate-400">/mo</span></div>
              <div className="text-sm text-slate-500 mb-5">Up to {plan.max_shops} shop{plan.max_shops > 1 ? "s" : ""} · {plan.max_orders_per_day} orders/day</div>
              <ul className="flex flex-col gap-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2.5 rounded-full font-bold text-sm transition-all ${i === 1 ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100" : "border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700"}`}>
                Get started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #22c55e 0%, transparent 50%), radial-gradient(circle at 80% 20%, #22c55e 0%, transparent 40%)" }} />
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <div className="text-emerald-400 font-bold text-sm uppercase tracking-widest mb-4">Get Started</div>
          <h2 className="text-4xl font-extrabold mb-4">{hp.contact.title}</h2>
          <p className="text-slate-400 mb-10 text-lg">{hp.contact.subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <a href="#" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-full transition-all shadow-xl shadow-emerald-900/50">📱 Download App</a>
            <a href="#pricing" className="border border-slate-600 hover:border-emerald-500 hover:text-emerald-400 text-white font-bold px-8 py-4 rounded-full transition-all">🏪 Register Shop</a>
          </div>
          <p className="text-slate-500 text-sm">Questions? Email us at <a href={`mailto:${hp.contact.email}`} className="text-emerald-400 hover:text-emerald-300 underline">{hp.contact.email}</a></p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-extrabold text-xs">QP</div>
            <span className="font-bold text-emerald-600">QuickPick</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500 flex-wrap justify-center">
            {["about","terms","privacy","revenue"].map((slug) => (
              <a key={slug} href={`/pages/${slug}`} className="hover:text-emerald-600 transition-colors capitalize">{slug === "revenue" ? "Revenue Model" : slug}</a>
            ))}
          </div>
          <div className="text-sm text-slate-400">© {new Date().getFullYear()} QuickPick. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
