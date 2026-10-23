import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Rust-free Prisma client talking to Postgres through node-pg. Compared with the
// old query engine this removes ~60 MB from every serverless function (faster cold
// starts) and the extra BEGIN / DEALLOCATE ALL / COMMIT round trips the engine added
// around each query when pgbouncer mode was on.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");

  // "pgbouncer=true" was a flag for the old engine; node-pg doesn't use it.
  const url = new URL(raw);
  url.searchParams.delete("pgbouncer");

  const adapter = new PrismaPg({
    connectionString: url.toString(),
    // Supabase's pooler uses its own CA; encrypt but don't verify the chain
    // (same as the old engine's default "prefer" mode).
    ssl: { rejectUnauthorized: false },
    // Serverless: a handful of connections per instance is plenty and keeps the
    // pooler's connection budget safe when many instances start at once.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  const logQueries = process.env.PRISMA_QUERY_LOG === "1";
  const client = new PrismaClient({ adapter, log: logQueries ? [{ emit: "event", level: "query" }] : [] });
  if (logQueries) {
    (client as unknown as { $on: (e: string, cb: (q: { query: string; duration: number }) => void) => void }).$on(
      "query",
      (e) => console.log(`PQ ${e.duration}ms ${e.query.replace(/\s+/g, " ").slice(0, 90)}`)
    );
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
