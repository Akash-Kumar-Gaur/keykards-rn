/**
 * Unit tests for EMV TLV + PAN classification (no NFC hardware required).
 */

import {
  bcdPanToDigits,
  bytesToHex,
  findTag,
  hexToBytes,
  parseExpiryBcd,
  parseTlv,
  parseTrack2,
} from '@/lib/emv/tlv';
import { classifyPan } from '@/lib/emv/panClassify';

describe('EMV TLV', () => {
  it('parses nested constructed tags', () => {
    // 6F 0A 84 08 A0000000031010  — FCI template with DF name
    const bytes = hexToBytes('6F0A8408A0000000031010');
    const nodes = parseTlv(bytes);
    expect(nodes[0].tag).toBe('6F');
    const df = findTag(nodes, '84');
    expect(df).toBeTruthy();
    expect(bytesToHex(df!.value)).toBe('A0000000031010');
  });

  it('decodes BCD PAN and stops at F filler', () => {
    // 4111 1111 1111 1111 + F filler nibble packed
    const bytes = hexToBytes('4111111111111111FF');
    expect(bcdPanToDigits(bytes)).toBe('4111111111111111');
  });

  it('parses Track 2 equivalent data', () => {
    const bytes = hexToBytes('4111111111111111D25122011234567890');
    const parsed = parseTrack2(bytes);
    expect(parsed.pan).toBe('4111111111111111');
    expect(parsed.expiry).toEqual({ month: 12, year: 2025 });
  });

  it('parses expiry YYMMDD', () => {
    expect(parseExpiryBcd(hexToBytes('251231'))).toEqual({
      month: 12,
      year: 2025,
    });
  });
});

describe('classifyPan', () => {
  it('accepts a Luhn-valid full PAN', () => {
    const c = classifyPan('4111111111111111');
    expect(c.quality).toBe('full');
    expect(c.lastFour).toBe('1111');
  });

  it('flags bank-masked PANs as partial', () => {
    const c = classifyPan('************1234');
    expect(c.quality).toBe('partial');
    expect(c.lastFour).toBe('1234');
  });

  it('treats short digit runs as partial', () => {
    const c = classifyPan('4821');
    expect(c.quality).toBe('partial');
    expect(c.digits).toBe('4821');
  });
});
