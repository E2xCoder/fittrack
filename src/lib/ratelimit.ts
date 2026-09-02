import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Fail open when Upstash isn't configured (local dev, preview builds):
// without this, every API request 500s inside the middleware.
const configured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = configured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

interface LimitResult {
  success: boolean;
  reset: number;
}

interface Limiter {
  limit(key: string): Promise<LimitResult>;
}

const noopLimiter: Limiter = {
  async limit() {
    return { success: true, reset: Date.now() };
  },
};

function makeLimiter(requests: number, prefix: string): Limiter {
  if (!redis) return noopLimiter;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, "1 m"),
    analytics: false,
    prefix,
  });
}

/** Auth endpoints — login, register, forgot-password */
export const strictLimit = makeLimiter(10, "rl:strict");

/** General API routes — dashboard, meals, workout, etc. */
export const apiLimit = makeLimiter(60, "rl:api");

/** Food search & barcode scan */
export const searchLimit = makeLimiter(20, "rl:search");
