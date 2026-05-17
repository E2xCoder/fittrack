import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-md justify-around py-4 text-sm">
          <Link href="/dashboard">
            Dashboard
          </Link>

          <Link href="/meals">
            Meals
          </Link>

          <Link href="/workout">
            Workout
          </Link>

          <Link href="/analytics">
            Analytics
          </Link>

          <Link href="/profile">
            Profile
          </Link>
        </div>
      </nav>
    </div>
  );
}