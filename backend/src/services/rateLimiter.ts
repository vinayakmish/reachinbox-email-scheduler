import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Redis-backed distributed rate limiter for per-sender hourly email limits.
 *
 * Uses an atomic Redis Lua script to eliminate race conditions between
 * concurrent workers and multiple backend instances.
 *
 * Key format: rate_limit:{senderId}:{hourWindow}
 * where hourWindow = Math.floor(Date.now() / 3_600_000) (Unix epoch UTC hour)
 */

const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = tonumber(redis.call('get', key) or '0')

if current >= limit then
  return {0, current}
end

local new_count = redis.call('incr', key)
if new_count == 1 then
  redis.call('expire', key, ttl)
end

return {1, new_count}
`;

function getHourWindow(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 3_600_000);
}

function getRateLimitKey(senderId: string, hourWindow: number): string {
  return `rate_limit:${senderId}:${hourWindow}`;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  nextWindowMs: number;
}

export async function checkAndIncrementRateLimit(
  senderId: string,
  maxPerHour: number,
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(senderId, hourWindow);
  const ttlSeconds = 7200; // 2 hour TTL for auto-cleanup

  try {
    // Atomically check and reserve in Redis via single-roundtrip Lua script
    const result = (await redis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      key,
      maxPerHour.toString(),
      ttlSeconds.toString(),
    )) as [number, number];

    const isAllowed = result[0] === 1;
    const currentCount = result[1];

    if (!isAllowed) {
      // Calculate next UTC hour window start with remaining milliseconds
      const nextWindowStart = (hourWindow + 1) * 3_600_000;
      const nextWindowMs = Math.max(1000, nextWindowStart - Date.now());

      logger.warn(
        { senderId, currentCount, maxPerHour, nextWindowMs },
        'Hourly rate limit reached for sender — rescheduling email',
      );

      return { allowed: false, currentCount, nextWindowMs };
    }

    return { allowed: true, currentCount, nextWindowMs: 0 };
  } catch (err) {
    logger.error({ err, senderId }, 'Redis rate limit evaluation failed');
    throw err;
  }
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

