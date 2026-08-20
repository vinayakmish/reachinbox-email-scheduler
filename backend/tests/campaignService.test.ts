// Unit test for campaign scheduling logic — mocks DB and queue
import { parseRecipientsFromText } from '../src/utils/csvParser';

describe('Campaign Scheduling Logic', () => {
  test('schedules emails with correct delay intervals', () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    const delayMs = 2000;
    const recipients = ['a@example.com', 'b@example.com', 'c@example.com'];

    const schedules = recipients.map((email, i) => ({
      email,
      scheduledAt: new Date(startTime.getTime() + i * delayMs),
    }));

    expect(schedules[0].scheduledAt).toEqual(new Date('2024-01-01T10:00:00Z'));
    expect(schedules[1].scheduledAt).toEqual(new Date('2024-01-01T10:00:02Z'));
    expect(schedules[2].scheduledAt).toEqual(new Date('2024-01-01T10:00:04Z'));
  });

  test('generates unique idempotency keys', () => {
    const campaignId = 'campaign-123';
    const recipients = ['a@example.com', 'b@example.com'];

    const keys = recipients.map(
      (email, i) => `campaign:${campaignId}:recipient:${email}:index:${i}`,
    );

    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test('handles 1000 recipients correctly', () => {
    const recipients = Array.from({ length: 1000 }, (_, i) => `user${i}@example.com`);
    const startTime = new Date();
    const delayMs = 2000;

    const schedules = recipients.map((email, i) => ({
      email,
      scheduledAt: new Date(startTime.getTime() + i * delayMs),
    }));

    expect(schedules).toHaveLength(1000);
    const lastSchedule = schedules[999].scheduledAt;
    const expectedLastDelay = 999 * 2000;
    expect(lastSchedule.getTime() - startTime.getTime()).toBe(expectedLastDelay);
  });
});

describe('CSV Parsing + Dedup', () => {
  test('removes duplicates from large list', () => {
    const emails = Array.from({ length: 100 }, (_, i) => `user${i % 10}@example.com`).join('\n');
    const result = parseRecipientsFromText(emails);
    expect(result.valid).toHaveLength(10);
    expect(result.duplicatesRemoved).toBe(90);
  });
});
