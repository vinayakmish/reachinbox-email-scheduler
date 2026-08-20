import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Redis-backed distributed rate limiter for per-sender hourly email limits.
 *
 * Uses atomic INCR + EXPIRE to safely handle concurrent workers.
 * Key format: rate_limit:{senderId}:{hourWindow}
 * where hourWindow = Math.floor(Date.now() / 3_600_000)
 */

function getHourWindow(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 3_600_000);
}

function getRateLimitKey(senderId: string, hourWindow: number): string {
  return `rate_limit:${senderId}:${hourWindow}`;
}

export async function checkAndIncrementRateLimit(
  senderId: string,
  maxPerHour: number,
): Promise<{ allowed: boolean; currentCount: number; nextWindowMs: number }> {
  const redis = getRedisClient();
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(senderId, hourWindow);

  // Atomically increment; if result > limit, decrement and reject
  const count = await redis.incr(key);

  // Set TTL of 2 hours so keys auto-expire
  if (count === 1) {
    await redis.expire(key, 7200);
  }

  if (count > maxPerHour) {
    // Decrement since we won't be sending
    await redis.decr(key);

    // Calculate next window start
    const nextWindowStart = (hourWindow + 1) * 3_600_000;
    const nextWindowMs = nextWindowStart - Date.now();

    logger.warn(
      { senderId, count: count - 1, maxPerHour, nextWindowMs },
      'Rate limit reached — rescheduling email',
    );

    return { allowed: false, currentCount: count - 1, nextWindowMs };
  }

  return { allowed: true, currentCount: count, nextWindowMs: 0 };
}

export async function getRateLimitCount(senderId: string): Promise<number> {
  const redis = getRedisClient();
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(senderId, hourWindow);
  const val = await redis.get(key);
  return val ? parseInt(val, 10) : 0;
}

export async function resetRateLimit(senderId: string): Promise<void> {
  const redis = getRedisClient();
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(senderId, hourWindow);
  await redis.del(key);
}
