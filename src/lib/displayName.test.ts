import {
  emailLocalPart,
  greetingFirstName,
  isUnsetDisplayName,
  normalizeDisplayName,
  resolveDisplayName,
  validateDisplayNameInput,
} from './displayName';

describe('normalizeDisplayName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeDisplayName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });
});

describe('isUnsetDisplayName', () => {
  it('treats empty as unset', () => {
    expect(isUnsetDisplayName(null, 'a@b.com')).toBe(true);
    expect(isUnsetDisplayName('  ', 'a@b.com')).toBe(true);
  });

  it('treats email local-part as unset (legacy trigger)', () => {
    expect(isUnsetDisplayName('ada', 'ada@example.com')).toBe(true);
    expect(isUnsetDisplayName('Ada', 'ada@example.com')).toBe(true);
  });

  it('accepts a real full name', () => {
    expect(isUnsetDisplayName('Ada Lovelace', 'ada@example.com')).toBe(false);
  });
});

describe('resolveDisplayName', () => {
  it('returns null for email-prefix profile names', () => {
    expect(
      resolveDisplayName(
        { email: 'ada@example.com', user_metadata: {} } as never,
        'ada',
      ),
    ).toBeNull();
  });

  it('returns a real profile name', () => {
    expect(
      resolveDisplayName(
        { email: 'ada@example.com', user_metadata: {} } as never,
        'Ada Lovelace',
      ),
    ).toBe('Ada Lovelace');
  });
});

describe('greetingFirstName', () => {
  it('uses the first word', () => {
    expect(greetingFirstName('Ada Lovelace')).toBe('Ada');
  });
});

describe('validateDisplayNameInput', () => {
  it('rejects empty', () => {
    expect(validateDisplayNameInput('  ')).toBe('Enter your full name.');
  });

  it('accepts a reasonable name', () => {
    expect(validateDisplayNameInput('Ada Lovelace')).toBeNull();
  });
});

describe('emailLocalPart', () => {
  it('extracts the local part', () => {
    expect(emailLocalPart('ada@example.com')).toBe('ada');
  });
});
