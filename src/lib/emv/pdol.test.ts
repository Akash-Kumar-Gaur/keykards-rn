import {
  AMEX_9F6E_CANDIDATES,
  buildGpo,
  buildGpoVariants,
  parsePdol,
  pdolDefault,
} from './pdol';

describe('PDOL builder', () => {
  it('parses multi-byte tags and lengths', () => {
    // 9F66 04  9F02 06  9F37 04
    const pdol = [0x9f, 0x66, 0x04, 0x9f, 0x02, 0x06, 0x9f, 0x37, 0x04];
    expect(parsePdol(pdol)).toEqual([
      { tag: '9F66', length: 4 },
      { tag: '9F02', length: 6 },
      { tag: '9F37', length: 4 },
    ]);
  });

  it('fills TTQ (9F66) with a non-zero Visa-friendly default', () => {
    const v = pdolDefault('9F66', 4);
    expect(v).toHaveLength(4);
    expect(v[0]).not.toBe(0);
  });

  it('fills Amex 9F6E with non-zero Enhanced Contactless Reader Capabilities', () => {
    const v = pdolDefault('9F6E', 4);
    expect(v).toHaveLength(4);
    expect(v.some((b) => b !== 0)).toBe(true);
  });

  it('builds GPO with PDOL-related data tag 83', () => {
    const pdol = [0x9f, 0x66, 0x04, 0x9f, 0x02, 0x06];
    const cmd = buildGpo(pdol);
    expect(cmd[0]).toBe(0x80);
    expect(cmd[1]).toBe(0xa8);
    // payload starts with 83 <len>
    expect(cmd[5]).toBe(0x83);
    expect(cmd[6]).toBe(10); // 4 + 6
  });

  it('builds empty GPO when PDOL missing', () => {
    expect(buildGpo(null)).toEqual([0x80, 0xa8, 0x00, 0x00, 0x02, 0x83, 0x00, 0x00]);
  });

  it('builds Amex-style GPO variants with multiple 9F6E values', () => {
    // 9F35/1 + 9F6E/4 — matches failing Amex logs
    const pdol = [0x9f, 0x35, 0x01, 0x9f, 0x6e, 0x04];
    const variants = buildGpoVariants(pdol);
    expect(variants.length).toBeGreaterThan(AMEX_9F6E_CANDIDATES.length);
    // First variant should use non-zero 9F6E (after 9F35 byte)
    const first = variants[0]!;
    // 80 A8 00 00 Lc 83 05 <9F35> <4x 9F6E> 00
    expect(first[5]).toBe(0x83);
    expect(first[6]).toBe(5);
    const nineF6e = first.slice(8, 12);
    expect(nineF6e.some((b) => b !== 0)).toBe(true);
  });
});
