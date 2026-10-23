"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email) return;
    setLoading(true);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
    } catch {
      // Always show "sent" regardless — avoids email enumeration
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold">FitTrack</h1>
        <p className="mb-8 text-zinc-400">Reset your password</p>

        {sent ? (
          <div className="rounded-2xl bg-zinc-900 p-6 text-center">
            <p className="mb-2 text-2xl">📧</p>
            <p className="font-semibold text-white">Email sent</p>
            <p className="mt-2 text-sm text-zinc-400">
              If an account is registered to <strong className="text-zinc-200">{email}</strong>, a reset link has been sent.
            </p>
            <p className="mt-1 text-xs text-zinc-500">Check your spam folder too.</p>
            <Link href="/login" className="mt-4 block text-sm text-green-400 hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email adresiniz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="rounded-2xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !email}
              className="rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
            <Link href="/login" className="text-center text-sm text-zinc-500 hover:text-zinc-300">
              Back to login
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
