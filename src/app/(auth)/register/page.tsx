"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    setError("");
    const { error } = await authClient.signUp.email({ name, email, password });
    if (error) {
      setError(error.message ?? "Registration failed");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold">FitTrack</h1>
        <p className="mb-8 text-zinc-400">Create your account</p>

        <div className="flex flex-col gap-3">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
          />
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
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleRegister}
            disabled={loading}
            className="rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-zinc-400">
            Have an account?{" "}
            <Link href="/login" className="text-green-400 hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-center text-[11px] text-zinc-600">
            By registering you accept the{" "}
            <Link href="/privacy" className="text-zinc-500 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}