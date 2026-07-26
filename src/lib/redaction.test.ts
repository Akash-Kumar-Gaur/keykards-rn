/**
 * Unit tests for the redaction utility.
 */

import { redact, redactString } from './redaction';

describe('redactString', () => {
  it('redacts a Luhn-valid 16-digit PAN', () => {
    expect(redactString('card 4111 1111 1111 1111 ok')).toBe('card [REDACTED] ok');
  });

  it('redacts a dash-separated PAN', () => {
    expect(redactString('4111-1111-1111-1111')).toBe('[REDACTED]');
  });

  it('redacts labelled CVV', () => {
    expect(redactString('cvv: 123')).toContain('[REDACTED]');
    expect(redactString('cvv: 123')).not.toContain('123');
  });

  it('redacts labelled expiry', () => {
    const out = redactString('exp 09/28');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('09/28');
  });

  it('leaves ordinary short numbers alone', () => {
    expect(redactString('order 12345 shipped')).toBe('order 12345 shipped');
  });
});

describe('redact (deep)', () => {
  it('redacts values under sensitive keys regardless of shape', () => {
    const out = redact({ cardNumber: 'anything', note: 'hi' }) as Record<string, unknown>;
    expect(out.cardNumber).toBe('[REDACTED]');
    expect(out.note).toBe('hi');
  });

  it('redacts nested structures and arrays', () => {
    const out = redact({
      items: [{ pan: '4111111111111111' }, { label: '4111 1111 1111 1111' }],
    }) as any;
    expect(out.items[0].pan).toBe('[REDACTED]');
    expect(out.items[1].label).toBe('[REDACTED]');
  });

  it('handles Error objects and circular refs', () => {
    const err = new Error('cvv: 999');
    const out = redact(err) as any;
    expect(out.message).not.toContain('999');

    const circular: any = { a: 1 };
    circular.self = circular;
    expect(() => redact(circular)).not.toThrow();
  });

  it('redacts access/refresh tokens by key', () => {
    const out = redact({ access_token: 'abc', refresh_token: 'def' }) as any;
    expect(out.access_token).toBe('[REDACTED]');
    expect(out.refresh_token).toBe('[REDACTED]');
  });

  it('redacts statement / PDF payload keys', () => {
    const out = redact({
      pdfBase64: 'JVBERi0x...',
      statement_text: 'Account holder RAVI SHARMA card 4111111111111111',
      ok: true,
    }) as Record<string, unknown>;
    expect(out.pdfBase64).toBe('[REDACTED]');
    expect(out.statement_text).toBe('[REDACTED]');
    expect(out.ok).toBe(true);
  });

  it('redacts share PAN / master-key shaped payload keys', () => {
    const out = redact({
      number_full: '4111 1111 1111 1111',
      share_master_key: 'abc',
      share_key: 'def',
      ok: true,
    }) as Record<string, unknown>;
    expect(out.number_full).toBe('[REDACTED]');
    expect(out.share_master_key).toBe('[REDACTED]');
    expect(out.share_key).toBe('[REDACTED]');
    expect(out.ok).toBe(true);
  });
});
