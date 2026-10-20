import { describe, expect, it } from 'vitest';
import {
  countSmsParts,
  isWithinSmsPartLimit,
  FEEDBACK_INVITE_BOTH,
  pickFeedbackInviteBody,
} from './sms';

describe('countSmsParts', () => {
  it('counts GSM-7 single part under 160', () => {
    const r = countSmsParts('Hello from Value Family Hospital');
    expect(r.encoding).toBe('gsm7');
    expect(r.parts).toBe(1);
  });
  it('uses UCS-2 when non-GSM characters present', () => {
    const r = countSmsParts('Hello 💜');
    expect(r.encoding).toBe('ucs2');
  });
  it('counts UCS-2 length in UTF-16 code units', () => {
    const r = countSmsParts('💜'.repeat(36));
    expect(r.length).toBe(72);
    expect(r.parts).toBe(2);
  });
});

describe('isWithinSmsPartLimit', () => {
  it('allows up to 3 parts', () => {
    expect(isWithinSmsPartLimit('Hi')).toBe(true);
  });
});

describe('pickFeedbackInviteBody', () => {
  it('returns a non-empty invite within 3 parts', () => {
    const body = pickFeedbackInviteBody();
    expect(body.length).toBeGreaterThan(20);
    expect(isWithinSmsPartLimit(body)).toBe(true);
    expect(body.includes('valuefamilyhospital.com')).toBe(true);
  });
});
