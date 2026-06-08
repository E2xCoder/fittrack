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
    if (!token) setError("Geçersiz veya süresi dolmuş link.");
  }, [token]);

  async function handleReset() {
    setError("");
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (err) {
        setError(err.message ?? "Bir hata oluştu. Link geçersiz veya süresi dolmuş olabilir.");
      } else {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-zinc-900 p-6 text-center">
        <p className="mb-2 text-2xl">✅</p>
        <p className="font-semibold text-white">Şifre güncellendi!</p>
        <p className="mt-2 text-sm text-zinc-400">Birkaç saniye içinde giriş sayfasına yönlendiriliyorsunuz…</p>
        <Link href="/login" className="mt-4 block text-sm text-green-400 hover:underline">
          Hemen giriş yap
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!token && (
        <div className="rounded-2xl bg-red-950/40 p-4 text-sm text-red-400">
          Geçersiz veya süresi dolmuş link. Yeni bir sıfırlama isteği gönderin.
        </div>
      )}
      {token && (
        <>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Yeni şifre (en az 8 karakter)"
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
            placeholder="Şifreyi tekrar girin"
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
            {loading ? "Kaydediliyor…" : "Şifremi Güncelle"}
          </button>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-zinc-500 hover:text-zinc-300">
        Girişe dön
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold">FitTrack</h1>
        <p className="mb-8 text-zinc-400">Yeni şifrenizi belirleyin</p>
        <Suspense fallback={<div className="text-zinc-400">Yükleniyor…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
