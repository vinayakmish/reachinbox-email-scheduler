// Note: This test requires Redis to be running
// Run with: jest tests/rateLimiter.test.ts
import { checkAndIncrementRateLimit, resetRateLimit } from '../src/services/rateLimiter';
import { closeRedis } from '../src/config/redis';

describe('Rate Limiter', () => {
  const senderId = `test-sender-${Date.now()}`;
  const maxPerHour = 3;

  afterEach(async () => {
    await resetRateLimit(senderId);
  });

  afterAll(async () => {
    await closeRedis();
  });

  test('allows emails within limit', async () => {
    for (let i = 0; i < maxPerHour; i++) {
      const result = await checkAndIncrementRateLimit(senderId, maxPerHour);
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(i + 1);
    }
  });

  test('rejects when limit is exceeded', async () => {
    // Fill up the limit
    for (let i = 0; i < maxPerHour; i++) {
      await checkAndIncrementRateLimit(senderId, maxPerHour);
    }

    // Next should be rejected
    const result = await checkAndIncrementRateLimit(senderId, maxPerHour);
    expect(result.allowed).toBe(false);
    expect(result.nextWindowMs).toBeGreaterThan(0);
  });

  test('count stays correct after rejection', async () => {
    // Fill up
    for (let i = 0; i < maxPerHour; i++) {
      await checkAndIncrementRateLimit(senderId, maxPerHour);
    }

    // Reject
    const rejected = await checkAndIncrementRateLimit(senderId, maxPerHour);
    expect(rejected.currentCount).toBe(maxPerHour); // Count didn't increment
  });
});
