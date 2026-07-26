import {
  digitsOnly,
  formatCardNumberGroups,
  formatMaskedCardNumber,
  isValidLuhn,
  maskCardNumber,
} from './cardUtils';

describe('formatMaskedCardNumber', () => {
  it('shows only last 4 while masking the rest', () => {
    expect(formatMaskedCardNumber('4111111111114821')).toBe('•••• •••• •••• 4821');
  });

  it('shows short numbers fully (they are the last 4)', () => {
    expect(formatMaskedCardNumber('4821')).toBe('4821');
    expect(formatMaskedCardNumber('821')).toBe('821');
  });

  it('groups as the number grows', () => {
    expect(formatMaskedCardNumber('411111111111')).toBe('•••• •••• 1111');
  });
});

describe('maskCardNumber', () => {
  it('pads last four for card face', () => {
    expect(maskCardNumber('21')).toBe('•••• •••• •••• 0021');
  });
});

describe('formatCardNumberGroups + Luhn', () => {
  it('keeps digits for encryption path', () => {
    const grouped = formatCardNumberGroups('4111111111111111');
    expect(digitsOnly(grouped)).toBe('4111111111111111');
    expect(isValidLuhn(digitsOnly(grouped))).toBe(true);
  });
});
