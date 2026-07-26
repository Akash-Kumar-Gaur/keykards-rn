import {
  hasDisplayableCardholderName,
  suggestedCardholderName,
} from './cardholderName';

describe('hasDisplayableCardholderName', () => {
  it('rejects null, empty, and dash placeholders', () => {
    expect(hasDisplayableCardholderName(null)).toBe(false);
    expect(hasDisplayableCardholderName('')).toBe(false);
    expect(hasDisplayableCardholderName('   ')).toBe(false);
    expect(hasDisplayableCardholderName('-')).toBe(false);
    expect(hasDisplayableCardholderName('—')).toBe(false);
  });

  it('accepts a real printed name', () => {
    expect(hasDisplayableCardholderName('ASHISH KUMAR')).toBe(true);
  });
});

describe('suggestedCardholderName', () => {
  it('prefers profiles.display_name over metadata', () => {
    expect(
      suggestedCardholderName(
        {
          user_metadata: { full_name: 'Meta Name' },
        } as never,
        'Profile Name',
      ),
    ).toBe('Profile Name');
  });

  it('falls back to user_metadata.full_name', () => {
    expect(
      suggestedCardholderName({
        user_metadata: { full_name: 'Meta Name' },
      } as never),
    ).toBe('Meta Name');
  });

  it('returns null when nothing is available', () => {
    expect(suggestedCardholderName(null)).toBeNull();
  });
});
