import { isVerifiedGmailConnection } from '@/lib/gmailConnection';

describe('isVerifiedGmailConnection', () => {
  it('requires connected status AND verified OAuth token', () => {
    expect(
      isVerifiedGmailConnection({ status: 'connected', hasVerifiedOauth: true }),
    ).toBe(true);
  });

  it('rejects connected status without OAuth token (fake opt-in)', () => {
    expect(
      isVerifiedGmailConnection({ status: 'connected', hasVerifiedOauth: false }),
    ).toBe(false);
  });

  it('rejects revoked / error / missing rows', () => {
    expect(
      isVerifiedGmailConnection({ status: 'revoked', hasVerifiedOauth: true }),
    ).toBe(false);
    expect(isVerifiedGmailConnection(null)).toBe(false);
    expect(isVerifiedGmailConnection(undefined)).toBe(false);
  });
});
