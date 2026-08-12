"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, saveToken, hasToken, User } from "@/lib/api";
import QuickPickLogo from "@/components/QuickPickLogo";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep]       = useState<Step>("phone");
  const [phone, setPhone]     = useState("");
  const [otp, setOtp]         = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  useEffect(() => {
    if (hasToken()) router.replace("/admin/dashboard");
  }, [router]);

  const sendOtp = async () => {
    setErr("");
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) { setErr("Enter a valid 10-digit phone number"); return; }
    setLoading(true);
    try {
      const fullPhone = `+91${digits}`;
      const data = await api.post<{ ok: boolean; mock_otp: string }>("/auth/request-otp", { phone: fullPhone });
      setPhone(fullPhone);
      setMockOtp(data.mock_otp);
      setStep("otp");
    } catch (e: any) {
      setErr(e.message ?? "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setErr("");
    if (otp.length !== 6) { setErr("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; user: User; is_new_user: boolean }>("/auth/verify-otp", { phone, otp });
      if (data.user.role !== "admin") { setErr("Access denied. Admin accounts only."); setLoading(false); return; }
      saveToken(data.access_token);
      router.replace("/admin/dashboard");
    } catch (e: any) {
      setErr(e.message ?? "Invalid OTP");
    } finally { setLoading(false); }
  };

  return (
    <div className="admin-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob blob-1 float-slow" />
        <div className="blob blob-2 float-reverse" />
        <div className="blob blob-3 float-med" />
      </div>

      {/* Decorative ring */}
      <div className="absolute w-[600px] h-[600px] rounded-full border border-emerald-200/30 spin-slow pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full border border-emerald-300/20 pointer-events-none" style={{ animation: "spin-slow 35s linear infinite reverse" }} />

      <div className="relative z-10 w-full max-w-md anim-scale-in">
        {/* Card */}
        <div className="glass rounded-3xl shadow-2xl shadow-emerald-900/10 p-8 border border-white/60">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-400/20 rounded-2xl blur-xl" />
                <QuickPickLogo size={56} className="relative z-10" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Admin Portal</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to manage your platform</p>
          </div>

          {step === "phone" ? (
            <div className="anim-fade-in">
              <div className="mb-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Phone Number</label>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center w-14 h-12 bg-white/70 backdrop-blur border border-white/60 rounded-xl font-bold text-slate-700 text-sm flex-shrink-0">
                    🇮🇳 +91
                  </div>
                  <input
                    value={phone.replace(/^\+91/, "")}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                    type="tel" maxLength={10} placeholder="98765 43210"
                    className="glass-input flex-1 h-12 text-base"
                  />
                </div>
              </div>

              {err && (
                <div className="mt-3 mb-4 p-3 rounded-xl bg-red-50/80 backdrop-blur border border-red-200 text-red-600 text-sm anim-fade-in">
                  {err}
                </div>
              )}

              <button onClick={sendOtp} disabled={loading}
                className="btn-primary w-full justify-center h-12 text-base mt-4 rounded-xl disabled:opacity-60">
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                  : "Send OTP →"
                }
              </button>
            </div>
          ) : (
            <div className="anim-fade-in">
              <button onClick={() => { setStep("phone"); setErr(""); setOtp(""); }}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors mb-5">
                ← Back
              </button>

              <div className="mb-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Verification Code</label>
                <p className="text-sm text-slate-500 mb-4">Sent to <span className="font-semibold text-slate-700">{phone}</span></p>
              </div>

              {mockOtp && (
                <div className="bg-emerald-50/80 backdrop-blur border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 anim-fade-in">
                  <span className="text-emerald-500">ℹ️</span>
                  <span className="text-sm text-emerald-800">Dev OTP: <strong className="tracking-[0.3em] font-extrabold">{mockOtp}</strong></span>
                </div>
              )}

              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                type="tel" maxLength={6} placeholder="• • • • • •"
                className="glass-input w-full h-16 text-center text-3xl font-extrabold tracking-[0.5em] mb-2"
              />

              {err && (
                <div className="mt-2 mb-4 p-3 rounded-xl bg-red-50/80 backdrop-blur border border-red-200 text-red-600 text-sm anim-fade-in">
                  {err}
                </div>
              )}

              <button onClick={verifyOtp} disabled={loading || otp.length < 6}
                className="btn-primary w-full justify-center h-12 text-base mt-2 rounded-xl disabled:opacity-60">
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying…</>
                  : "Verify & Enter →"
                }
              </button>
            </div>
          )}

          {/* Step dots */}
          <div className="flex justify-center gap-2 mt-6">
            {["phone", "otp"].map((s) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${step === s ? "w-6 bg-emerald-500" : "w-1.5 bg-slate-200"}`} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 px-1">
          <Link href="/" className="text-xs text-slate-500 hover:text-emerald-600 transition-colors">← Back to home</Link>
          <p className="text-xs text-slate-400">Admin only · seed: +919999999999</p>
        </div>
      </div>
    </div>
  );
}
