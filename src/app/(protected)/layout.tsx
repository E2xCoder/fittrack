"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const navItems = [
  { href: "/dashboard", label: "Home", icon: "📊" },
  { href: "/meals", label: "Meals", icon: "🍽️" },
  { href: "/workout", label: "Train", icon: "🏋️" },
  { href: "/body", label: "Body", icon: "⚖️" },
  { href: "/analytics", label: "Stats", icon: "📈" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to onboarding if not completed
  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((user) => {
        if (user && user.onboardingCompleted === false) {
          router.replace("/onboarding");
        }
      })
      .catch(() => {});
  }, [router]);

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-xl font-bold">
            FitTrack
          </Link>

          <div className="hidden flex-wrap gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl px-4 py-2 text-sm transition ${
                  pathname === item.href
                    ? "bg-green-600 text-white"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="rounded-2xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl pb-24 md:pb-0">
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950 md:hidden">
        <div className="flex items-center justify-around py-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-1 py-2 transition ${
                pathname === item.href ? "text-green-400" : "text-zinc-500"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}