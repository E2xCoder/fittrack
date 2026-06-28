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
        <p className="mb-8 text-zinc-400">Şifrenizi sıfırlayın</p>

        {sent ? (
          <div className="rounded-2xl bg-zinc-900 p-6 text-center">
            <p className="mb-2 text-2xl">📧</p>
            <p className="font-semibold text-white">Email gönderildi</p>
            <p className="mt-2 text-sm text-zinc-400">
              <strong className="text-zinc-200">{email}</strong> adresine kayıtlı bir hesap varsa sıfırlama linki gönderildi.
            </p>
            <p className="mt-1 text-xs text-zinc-500">Spam klasörünü de kontrol edin.</p>
            <Link href="/login" className="mt-4 block text-sm text-green-400 hover:underline">
              Girişe dön
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
              {loading ? "Gönderiliyor…" : "Sıfırlama Linki Gönder"}
            </button>
            <Link href="/login" className="text-center text-sm text-zinc-500 hover:text-zinc-300">
              Girişe dön
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
