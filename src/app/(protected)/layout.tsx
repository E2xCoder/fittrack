"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href:
      "/dashboard",
    label:
      "Dashboard",
    icon: "📊",
  },
  {
    href:
      "/meals",
    label:
      "Meals",
    icon: "🍽️",
  },
  {
    href:
      "/workout",
    label:
      "Workout",
    icon: "🏋️",
  },
  {
    href:
      "/analytics",
    label:
      "Analytics",
    icon: "📈",
  },
  {
    href:
      "/profile",
    label:
      "Profile",
    icon: "👤",
  },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname =
    usePathname();

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/dashboard"
            className="text-xl font-bold"
          >
            FitTrack
          </Link>

          <div className="flex flex-wrap gap-2">
            {navItems.map(
              (item) => {
                const active =
                  pathname ===
                  item.href;

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className={`rounded-2xl px-4 py-2 text-sm transition ${
                      active
                        ? "bg-green-600 text-white"
                        : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="mr-2">
                      {
                        item.icon
                      }
                    </span>

                    {
                      item.label
                    }
                  </Link>
                );
              }
            )}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl">
        {children}
      </div>
    </div>
  );
}