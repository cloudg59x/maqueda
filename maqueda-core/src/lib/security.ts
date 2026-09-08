import { RateLimiterMemory } from "rate-limiter-flexible";

// In-memory limiters: fine for a single instance MVP. Keyed by purpose so limits do not interfere.
const limiters = new Map<number, RateLimiterMemory>();
function limiter(points: number): RateLimiterMemory {
  let l = limiters.get(points);
  if (!l) {
    l = new RateLimiterMemory({ points, duration: 60 });
    limiters.set(points, l);
  }
  return l;
}

/** Allow `points` hits per minute per identifier. */
export async function checkRateLimit(identifier: string, points = 5): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  try {
    await limiter(points).consume(identifier);
    return { allowed: true };
  } catch (rejected) {
    const ms = (rejected as { msBeforeNext?: number }).msBeforeNext ?? 60_000;
    return { allowed: false, retryAfterSec: Math.ceil(ms / 1000) };
  }
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: "Password must be at least 8 characters long" };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "Password must contain at least one uppercase letter" };
  if (!/[a-z]/.test(password)) return { valid: false, message: "Password must contain at least one lowercase letter" };
  if (!/\d/.test(password)) return { valid: false, message: "Password must contain at least one number" };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, message: "Password must contain at least one special character" };
  return { valid: true, message: "Password is valid" };
}
