"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // 2FA step
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Login failed");
      setLoading(false);
    } else if ("twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsTwoFactor(true);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleVerifyTwoFactor() {
    setVerifying(true);
    setError("");
    const { error } = await authClient.twoFactor.verifyTotp({ code: otpCode });
    if (error) {
      setError(error.message ?? "Invalid code");
      setVerifying(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyLoading(true);
    setError("");
    const res = await authClient.signIn.passkey();
    if (res?.error) {
      setError(res.error.message ?? "Passkey sign-in failed");
      setPasskeyLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  if (needsTwoFactor) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-3xl font-bold">Two-Factor Code</h1>
          <p className="mb-8 text-zinc-400">Enter the code from your authenticator app</p>

          <div className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyTwoFactor()}
              className="rounded-2xl bg-zinc-900 p-3 text-center text-lg tracking-widest outline-none focus:ring-1 focus:ring-zinc-600"
              autoFocus
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleVerifyTwoFactor}
              disabled={verifying || otpCode.length < 6}
              className="rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>

            <button
              onClick={() => { setNeedsTwoFactor(false); setOtpCode(""); setError(""); }}
              className="text-center text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold">FitTrack</h1>
        <p className="mb-8 text-zinc-400">Sign in to your account</p>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full rounded-2xl bg-zinc-900 p-3 pr-12 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-zinc-500 hover:text-zinc-300">
              Forgot password?
            </Link>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <div className="h-px flex-1 bg-zinc-800" />
            or
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <button
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
            className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 py-3 font-semibold text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
          >
            {passkeyLoading ? "Waiting for device..." : "🔐 Sign in with Passkey (Face ID / Touch ID)"}
          </button>

          <p className="text-center text-sm text-zinc-400">
            No account?{" "}
            <Link href="/register" className="text-green-400 hover:underline">
              Register
            </Link>
          </p>

          <p className="text-center text-[11px] text-zinc-600">
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}