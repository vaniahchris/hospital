import { describe, expect, it } from 'vitest';
import { normalizeUgandanPhone } from './phone';

describe('normalizeUgandanPhone', () => {
  it('normalizes local 07 numbers', () => {
    expect(normalizeUgandanPhone('0775699700')).toBe('+256775699700');
  });
  it('normalizes 7… and 256… forms', () => {
    expect(normalizeUgandanPhone('775699700')).toBe('+256775699700');
    expect(normalizeUgandanPhone('256775699700')).toBe('+256775699700');
  });
  it('keeps already-E.164', () => {
    expect(normalizeUgandanPhone('+256775699700')).toBe('+256775699700');
  });
  it('rejects invalid', () => {
    expect(normalizeUgandanPhone('123')).toBeNull();
    expect(normalizeUgandanPhone('')).toBeNull();
    expect(normalizeUgandanPhone('abc')).toBeNull();
  });
});
