"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email) return;
    // TODO: email servisi kurulunca aktif edilecek
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold">FitTrack</h1>
        <p className="mb-8 text-zinc-400">Reset your password</p>

        {sent ? (
          <div className="rounded-2xl bg-zinc-900 p-6 text-center">
            <p className="mb-2 text-2xl">📧</p>
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-sm text-zinc-400">
              If an account exists for {email}, you'll receive a reset link shortly.
            </p>
            <Link href="/login" className="mt-4 block text-sm text-green-400 hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="rounded-2xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button
              onClick={handleSubmit}
              className="rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700"
            >
              Send Reset Link
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