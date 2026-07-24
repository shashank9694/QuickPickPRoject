"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveToken, User } from "@/lib/api";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🛍️</div>
          <h1 className="text-2xl font-extrabold text-slate-900">QuickPick Admin</h1>
          <p className="text-slate-500 mt-1">Sign in to manage your platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {step === "phone" ? (
            <>
              <h2 className="font-bold text-lg mb-1">Enter your phone</h2>
              <p className="text-sm text-slate-500 mb-6">We'll send you a 6-digit verification code.</p>
              <div className="flex gap-2 mb-4">
                <div className="flex items-center justify-center w-14 h-12 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700">+91</div>
                <input
                  value={phone.replace(/^\+91/, "")}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                  type="tel"
                  maxLength={10}
                  placeholder="98765 43210"
                  className="flex-1 h-12 px-4 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {err && <p className="text-red-500 text-sm mb-4">{err}</p>}
              <button
                onClick={sendOtp}
                disabled={loading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors"
              >
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep("phone"); setErr(""); setOtp(""); }} className="text-slate-400 hover:text-slate-700 mb-4 text-sm">← Back</button>
              <h2 className="font-bold text-lg mb-1">Enter verification code</h2>
              <p className="text-sm text-slate-500 mb-4">Sent to {phone}</p>
              {mockOtp && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
                  <span className="text-emerald-600">ℹ️</span>
                  <span className="text-sm text-emerald-800">Dev OTP: <strong className="tracking-widest">{mockOtp}</strong></span>
                </div>
              )}
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                type="tel"
                maxLength={6}
                placeholder="• • • • • •"
                className="w-full h-16 px-4 border border-slate-200 rounded-xl text-center text-3xl font-extrabold tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              />
              {err && <p className="text-red-500 text-sm mb-4">{err}</p>}
              <button
                onClick={verifyOtp}
                disabled={loading || otp.length < 6}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors"
              >
                {loading ? "Verifying…" : "Verify & Continue"}
              </button>
            </>
          )}
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">Admin access only. Seed phone: +919999999999</p>
      </div>
    </div>
  );
}
