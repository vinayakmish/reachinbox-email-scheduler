import { parseRecipientsFromText, isValidEmail } from '../src/utils/csvParser';

describe('isValidEmail', () => {
  test('valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    expect(isValidEmail('alice@gmail.com')).toBe(true);
  });

  test('invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('parseRecipientsFromText', () => {
  test('parses plain text one-per-line', () => {
    const input = 'alice@example.com\nbob@example.com\ncharlie@example.com';
    const result = parseRecipientsFromText(input);
    expect(result.valid).toHaveLength(3);
    expect(result.valid).toContain('alice@example.com');
    expect(result.duplicatesRemoved).toBe(0);
  });

  test('removes duplicates case-insensitively', () => {
    const input = 'alice@example.com\nAlice@Example.COM\nbob@example.com';
    const result = parseRecipientsFromText(input);
    expect(result.valid).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(1);
  });

  test('parses CSV with header', () => {
    const input = 'email\nalice@example.com\nbob@example.com';
    const result = parseRecipientsFromText(input);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });

  test('parses comma-separated emails', () => {
    const input = 'alice@example.com,bob@example.com,charlie@example.com';
    const result = parseRecipientsFromText(input);
    expect(result.valid).toHaveLength(3);
  });

  test('handles quoted CSV values', () => {
    const input = '"alice@example.com"\n"bob@example.com"';
    const result = parseRecipientsFromText(input);
    expect(result.valid).toHaveLength(2);
  });

  test('rejects invalid emails', () => {
    const input = 'alice@example.com\nnotvalid\n@bad.com';
    const result = parseRecipientsFromText(input);
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(2);
  });

  test('handles empty input', () => {
    const result = parseRecipientsFromText('');
    expect(result.valid).toHaveLength(0);
    expect(result.duplicatesRemoved).toBe(0);
  });
});
