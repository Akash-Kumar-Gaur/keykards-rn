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

  describe('cardholder name on cards with no printed name', () => {
    it('rejects usage boilerplate', () => {
      expect(extractCardholderName('ELECTRONIC USE ONLY')).toBeNull();
      expect(extractCardholderName('FOR ELECTRONIC USE ONLY')).toBeNull();
      expect(extractCardholderName('VALID ONLY IN INDIA')).toBeNull();
      expect(extractCardholderName('AUTHORISED SIGNATURE')).toBeNull();
      expect(extractCardholderName('NOT TRANSFERABLE')).toBeNull();
      expect(extractCardholderName('CUSTOMER CARE')).toBeNull();
    });

    it('rejects company names and suffixes', () => {
      expect(extractCardholderName('REDEVOLVE TECHNOLOGIES')).toBeNull();
      expect(extractCardholderName('REDEVOLVE PVT LTD')).toBeNull();
      expect(extractCardholderName('ACME SOLUTIONS LIMITED')).toBeNull();
    });

    it('rejects product tiers', () => {
      expect(extractCardholderName('WORLD ELITE')).toBeNull();
      expect(extractCardholderName('BUSINESS PRIME')).toBeNull();
      expect(extractCardholderName('CONTACTLESS ENABLED')).toBeNull();
    });

    it('rejects a single word, initials-only and OCR noise', () => {
      expect(extractCardholderName('REDEVOLVE')).toBeNull();
      expect(extractCardholderName('A B')).toBeNull();
      expect(extractCardholderName('XZQW MNBV')).toBeNull();
    });

    it('rejects lines carrying digits', () => {
      expect(extractCardholderName('CALL 18001234567')).toBeNull();
      expect(extractCardholderName('MEMBER SINCE 09')).toBeNull();
    });

    it('yields no name for a full card face without one', () => {
      const text = [
        'HDFC BANK',
        '4111 1111 1111 1111',
        'VALID THRU 09/29',
        'ELECTRONIC USE ONLY',
      ].join('\n');
      expect(parseCardOcrText(text)?.cardholderName).toBeNull();
    });

    it('still reads a real name printed below boilerplate', () => {
      const text = [
        'HDFC BANK',
        '4111 1111 1111 1111',
        'VALID THRU 09/29',
        'ELECTRONIC USE ONLY',
        'ASHA MENON',
      ].join('\n');
      expect(parseCardOcrText(text)?.cardholderName).toBe('Asha Menon');
    });

    it('keeps names that use an initial', () => {
      expect(extractCardholderName('A KUMAR')).toBe('A Kumar');
      expect(extractCardholderName('RAJESH K NAIR')).toBe('Rajesh K Nair');
    });
  });

  it('returns null when no PAN', () => {
    expect(parseCardOcrText('hello world\n12/28')).toBeNull();
  });
});
