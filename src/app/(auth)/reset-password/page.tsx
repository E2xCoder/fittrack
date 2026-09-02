"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid or expired link.");
  }, [token]);

  async function handleReset() {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (err) {
        setError(err.message ?? "Something went wrong. The link may be invalid or expired.");
      } else {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-zinc-900 p-6 text-center">
        <p className="mb-2 text-2xl">✅</p>
        <p className="font-semibold text-white">Password updated!</p>
        <p className="mt-2 text-sm text-zinc-400">Redirecting you to the login page in a few seconds…</p>
        <Link href="/login" className="mt-4 block text-sm text-green-400 hover:underline">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!token && (
        <div className="rounded-2xl bg-red-950/40 p-4 text-sm text-red-400">
          Invalid or expired link. Please request a new reset link.
        </div>
      )}
      {token && (
        <>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password (at least 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleReset()}
            className="rounded-2xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleReset}
            disabled={loading || !password || !confirm}
            className="rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Update My Password"}
          </button>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-zinc-500 hover:text-zinc-300">
        Back to login
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold">FitTrack</h1>
        <p className="mb-8 text-zinc-400">Choose your new password</p>
        <Suspense fallback={<div className="text-zinc-400">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
