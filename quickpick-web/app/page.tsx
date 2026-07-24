"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Plan, StaticPage } from "@/lib/api";

const NAV = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pages, setPages] = useState<StaticPage[]>([]);

  useEffect(() => {
    api.get<{ plans: Plan[] }>("/subscription/plans").then((d) => setPlans(d.plans)).catch(() => {});
    api.get<{ pages: StaticPage[] }>("/static-pages/about").catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛍️</span>
            <span className="font-extrabold text-xl text-emerald-600">QuickPick</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">{n.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Admin Login</Link>
            <a href="#pricing" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors">Get Started</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-block bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full mb-6 tracking-widest uppercase border border-emerald-200">
          Pre-order & Pickup Platform
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
          Skip the queue.<br />
          <span className="text-emerald-600">Pick up what you need.</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Pre-order from local shops. No waiting in line, no delivery fees, no surprises. Your order is ready when you arrive.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#how" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-full text-lg transition-colors shadow-lg shadow-emerald-200">
            How it works →
          </a>
          <a href="#pricing" className="border-2 border-slate-200 hover:border-emerald-400 text-slate-700 font-bold px-8 py-4 rounded-full text-lg transition-colors">
            For Shopkeepers
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-emerald-600 py-12">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-8 text-center text-white">
          {[["0 min", "Wait Time"], ["100%", "Contactless"], ["₹0", "Delivery Fee"]].map(([val, lab]) => (
            <div key={lab}>
              <div className="text-3xl font-extrabold">{val}</div>
              <div className="text-emerald-100 text-sm mt-1">{lab}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-24">
        <h2 className="text-4xl font-extrabold text-center mb-4">Everything you need</h2>
        <p className="text-slate-500 text-center mb-16">Built for speed, simplicity, and reliability at scale.</p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: "📱", title: "Order from your phone", desc: "Browse nearby shops, add items, and place your order in seconds. No account required for browsing." },
            { icon: "✅", title: "Shopkeeper confirms", desc: "The shopkeeper reviews your items, marks what's available, and sets the final price — no surprises." },
            { icon: "🔐", title: "OTP pickup", desc: "Get a unique OTP when your order is ready. Show it at the counter to collect your order instantly." },
            { icon: "💳", title: "Flexible payment", desc: "Pay online in full, or pay a 10% advance for COD orders and settle the rest at pickup." },
            { icon: "🗺️", title: "Nearby shops", desc: "Automatically shows shops near your location. Filter by category to find exactly what you need." },
            { icon: "📊", title: "Real-time tracking", desc: "Track your order status from placed → packed → ready. Get live updates without refreshing." },
          ].map((f) => (
            <div key={f.title} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-slate-50 py-24">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-extrabold text-center mb-4">How it works</h2>
          <p className="text-slate-500 text-center mb-16">Three simple steps for customers. Three simple steps for shopkeepers.</p>
          <div className="grid md:grid-cols-2 gap-12">
            {/* Customer */}
            <div>
              <div className="font-bold text-emerald-600 text-sm uppercase tracking-widest mb-6">For Customers</div>
              {[
                ["1", "Browse & Order", "Open the app, find a nearby shop, add items and place your pre-order in under a minute."],
                ["2", "Pay & Track", "Pay online or a small advance for COD. Track your order status in real-time."],
                ["3", "Show OTP & Pickup", "When your order is ready, head to the shop and show your OTP to collect it."],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-4 mb-8">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{num}</div>
                  <div>
                    <div className="font-bold mb-1">{title}</div>
                    <div className="text-slate-500 text-sm leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Shopkeeper */}
            <div>
              <div className="font-bold text-emerald-600 text-sm uppercase tracking-widest mb-6">For Shopkeepers</div>
              {[
                ["1", "Review & Price", "See incoming orders, mark unavailable items, and set prices per item. Total is auto-calculated."],
                ["2", "Pack & Ready", "After payment is received, pack the order and mark it ready for pickup."],
                ["3", "Verify OTP", "Customer shows their OTP at your counter. Scan or enter it to complete the order."],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-4 mb-8">
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{num}</div>
                  <div>
                    <div className="font-bold mb-1">{title}</div>
                    <div className="text-slate-500 text-sm leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 py-24">
        <h2 className="text-4xl font-extrabold text-center mb-4">Simple pricing for shopkeepers</h2>
        <p className="text-slate-500 text-center mb-16">Start with a free 14-day trial. No credit card required.</p>
        <div className="grid md:grid-cols-4 gap-6">
          {plans.length > 0 ? plans.filter(p => p.code !== "free_trial").map((plan, i) => (
            <div key={plan.code} className={`rounded-2xl p-6 border-2 flex flex-col ${i === 1 ? "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100" : "border-slate-200 bg-white"}`}>
              {i === 1 && <div className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full self-start mb-4 uppercase tracking-widest">Popular</div>}
              <div className="font-extrabold text-lg mb-1">{plan.name}</div>
              <div className="text-3xl font-extrabold mb-1">
                ₹{plan.price}<span className="text-base font-normal text-slate-400">/mo</span>
              </div>
              <div className="text-sm text-slate-500 mb-4">Up to {plan.max_shops} shop{plan.max_shops > 1 ? "s" : ""}</div>
              <ul className="flex flex-col gap-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-500 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2.5 rounded-full font-bold text-sm transition-colors ${i === 1 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-2 border-slate-200 hover:border-emerald-400 text-slate-700"}`}>
                Get started
              </button>
            </div>
          )) : (
            /* Fallback if API not loaded */
            [
              { name: "Starter", price: 299, shops: 1, popular: false },
              { name: "Growth", price: 599, shops: 3, popular: true },
              { name: "Pro", price: 999, shops: 10, popular: false },
            ].map((p) => (
              <div key={p.name} className={`rounded-2xl p-6 border-2 ${p.popular ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <div className="font-extrabold text-lg mb-1">{p.name}</div>
                <div className="text-3xl font-extrabold mb-4">₹{p.price}<span className="text-base font-normal text-slate-400">/mo</span></div>
              </div>
            ))
          )}
          {/* Free trial card */}
          <div className="rounded-2xl p-6 border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-center">
            <div className="text-3xl mb-3">🎁</div>
            <div className="font-extrabold text-lg mb-2">Free Trial</div>
            <div className="text-slate-500 text-sm mb-4">All Pro features free for 14 days. No payment needed.</div>
            <button className="bg-slate-900 hover:bg-slate-700 text-white font-bold px-6 py-2.5 rounded-full text-sm transition-colors">Start Free</button>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-slate-900 text-white py-24">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-extrabold mb-4">Ready to get started?</h2>
          <p className="text-slate-400 mb-8">Download the app and start ordering, or register your shop today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-full transition-colors">Download App</a>
            <a href="#pricing" className="border border-slate-600 hover:border-slate-400 text-white font-bold px-8 py-4 rounded-full transition-colors">Register Shop</a>
          </div>
          <p className="text-slate-500 text-sm mt-8">Questions? Email us at <a href="mailto:hello@quickpick.in" className="text-emerald-400 hover:underline">hello@quickpick.in</a></p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>🛍️</span>
            <span className="font-bold text-emerald-600">QuickPick</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            {["about", "terms", "privacy", "revenue"].map((slug) => (
              <a key={slug} href={`/pages/${slug}`} className="hover:text-slate-800 capitalize">{slug === "revenue" ? "Revenue Model" : slug.charAt(0).toUpperCase() + slug.slice(1)}</a>
            ))}
          </div>
          <div className="text-sm text-slate-400">© {new Date().getFullYear()} QuickPick</div>
        </div>
      </footer>
    </div>
  );
}
