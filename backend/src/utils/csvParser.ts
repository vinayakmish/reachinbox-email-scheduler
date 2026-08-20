import { ParsedRecipients } from '../types';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function parseRecipientsFromText(content: string): ParsedRecipients {
  // Split by newlines, commas, semicolons, or tabs
  const tokens = content
    .split(/[\n\r,;\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicatesRemoved = 0;

  for (const token of tokens) {
    // Remove surrounding quotes (CSV format)
    const cleaned = token.replace(/^"|"$/g, '').trim();

    // Skip header-like values
    if (cleaned.toLowerCase() === 'email' || cleaned.toLowerCase() === 'email address') {
      continue;
    }

    if (!isValidEmail(cleaned)) {
      // Could be a CSV header or invalid value — skip silently if it looks like a header
      if (cleaned.length > 0) {
        invalid.push(cleaned);
      }
      continue;
    }

    const normalized = cleaned.toLowerCase();
    if (seen.has(normalized)) {
      duplicatesRemoved++;
      continue;
    }

    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid, duplicatesRemoved };
}
