import {
  extractCardholderName,
  extractExpiry,
  extractPanCandidates,
  parseCardOcrText,
} from './cardOcrParse';

/** Classic Visa test PAN (Luhn-valid). */
const VISA = '4111111111111111';
const MC = '5555555555554444';

describe('cardOcrParse', () => {
  it('extracts a spaced Luhn-valid PAN', () => {
    const text = `VISA\n4111 1111 1111 1111\nVALID THRU 12/28\nAKASH KUMAR`;
    expect(extractPanCandidates(text)[0]).toBe(VISA);
    const parsed = parseCardOcrText(text);
    expect(parsed?.panDigits).toBe(VISA);
    expect(parsed?.expiryMonth).toBe(12);
    expect(parsed?.expiryYear).toBe(2028);
    expect(parsed?.cardholderName?.toLowerCase()).toContain('akash');
    expect(parsed?.networkHint).toBe('Visa');
  });

  it('extracts continuous PAN digits', () => {
    expect(extractPanCandidates(`PAN ${MC} END`)[0]).toBe(MC);
  });

  it('rejects non-Luhn digit runs', () => {
    expect(extractPanCandidates('4111111111111112')).toEqual([]);
    expect(parseCardOcrText('4111111111111112\n12/28')).toBeNull();
  });

  it('never treats a CVV-labeled code as a PAN', () => {
    const text = `CVV 123\nCVC: 456\n4111 1111 1111 1111\nEXP 08/29`;
    const parsed = parseCardOcrText(text);
    expect(parsed?.panDigits).toBe(VISA);
    expect(parsed?.panDigits).not.toMatch(/^123$|^456$/);
  });

  it('parses VALID THRU expiry', () => {
    expect(extractExpiry('VALID THRU 03/27')).toEqual({
      month: 3,
      year: 2027,
    });
  });

  it('skips bankish lines for cardholder name', () => {
    expect(extractCardholderName('PLATINUM REWARDS\nJOHN DOE')).toMatch(/John/i);
    expect(extractCardholderName('VISA\nMASTERCARD')).toBeNull();
  });

  it('returns null when no PAN', () => {
    expect(parseCardOcrText('hello world\n12/28')).toBeNull();
  });
});
