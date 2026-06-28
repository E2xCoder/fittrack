"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import PostHogProvider from "@/components/PostHogProvider";

// ── Nav icon — users / people (SVG, no emoji) ──────────────────────────────

function UsersIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ── Nav items ──────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon?: string;    // emoji / text
  svgIcon?: true;   // render UsersIcon SVG instead
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Home",    icon: "📊" },
  { href: "/meals",     label: "Meals",   icon: "🍽️" },
  { href: "/workout",   label: "Train",   icon: "🏋️" },
  { href: "/body",      label: "Body",    icon: "⚖️" },
  { href: "/analytics", label: "Stats",   icon: "📈" },
  { href: "/social",    label: "Social",  svgIcon: true },
  { href: "/profile",   label: "Profile", icon: "👤" },
];

// ── Layout ─────────────────────────────────────────────────────────────────

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((user) => {
        if (!user) return;
        const hasProfileData = user.calorieTarget || user.weight || user.height;
        if (user.onboardingCompleted === false && !hasProfileData) {
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
    <PostHogProvider>
      <div className="min-h-screen bg-black text-white">
        {/* Desktop top nav */}
        <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/dashboard" className="text-xl font-bold">FitTrack</Link>

            <div className="hidden flex-wrap gap-2 md:flex">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm transition ${
                      active ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {item.svgIcon ? (
                      <UsersIcon size={16} />
                    ) : (
                      <span>{item.icon}</span>
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <button
              onClick={handleLogout}
              className="rounded-2xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
            >
              Logout
            </button>
          </div>
        </nav>

        <div className="mx-auto max-w-7xl pb-24 md:pb-6">
          {children}
          <footer className="mt-8 hidden border-t border-zinc-800/50 py-4 text-center text-xs text-zinc-600 md:block">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">
              Privacy Policy · Gizlilik Politikasi
            </Link>
          </footer>
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950 md:hidden">
          <div className="flex items-center justify-around py-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 transition ${
                    active ? "text-green-400" : "text-zinc-500"
                  }`}
                >
                  {item.svgIcon ? (
                    <UsersIcon size={22} />
                  ) : (
                    <span className="text-xl">{item.icon}</span>
                  )}
                  <span className="text-[10px]">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="pb-safe-bottom text-center pb-0.5">
            <Link href="/privacy" className="text-[9px] text-zinc-700 hover:text-zinc-500 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </nav>
      </div>
    </PostHogProvider>
  );
}
