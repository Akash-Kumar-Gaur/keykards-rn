/**
 * EMV BER-TLV helpers — parse nested TLV streams from IsoDep APDU responses.
 * Never logs tag values that may contain PAN (5A / 57).
 */

export interface TlvNode {
  tag: string;
  length: number;
  value: number[];
  children?: TlvNode[];
}

function isConstructed(tagFirstByte: number): boolean {
  return (tagFirstByte & 0x20) !== 0;
}

function readTag(bytes: number[], offset: number): { tag: string; next: number } {
  let i = offset;
  const first = bytes[i++];
  let tagBytes = [first];
  // Multi-byte tag when lower 5 bits of first byte are all 1.
  if ((first & 0x1f) === 0x1f) {
    while (i < bytes.length) {
      const b = bytes[i++];
      tagBytes.push(b);
      if ((b & 0x80) === 0) break;
    }
  }
  return {
    tag: tagBytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase(),
    next: i,
  };
}

function readLength(bytes: number[], offset: number): { length: number; next: number } {
  let i = offset;
  const first = bytes[i++];
  if (first < 0x80) return { length: first, next: i };
  const count = first & 0x7f;
  let length = 0;
  for (let n = 0; n < count; n += 1) {
    length = (length << 8) | bytes[i++];
  }
  return { length, next: i };
}

export function parseTlv(bytes: number[]): TlvNode[] {
  const nodes: TlvNode[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] === 0x00 || bytes[i] === 0xff) {
      i += 1;
      continue;
    }
    const { tag, next: afterTag } = readTag(bytes, i);
    if (afterTag >= bytes.length) break;
    const { length, next: afterLen } = readLength(bytes, afterTag);
    const value = bytes.slice(afterLen, afterLen + length);
    const firstTagByte = parseInt(tag.slice(0, 2), 16);
    const node: TlvNode = { tag, length, value };
    if (isConstructed(firstTagByte) && value.length > 0) {
      try {
        node.children = parseTlv(value);
      } catch {
        // leave raw value
      }
    }
    nodes.push(node);
    i = afterLen + length;
  }
  return nodes;
}

export function findTag(nodes: TlvNode[], tag: string): TlvNode | null {
  const upper = tag.toUpperCase();
  for (const n of nodes) {
    if (n.tag === upper) return n;
    if (n.children) {
      const hit = findTag(n.children, upper);
      if (hit) return hit;
    }
  }
  return null;
}

export function findAllTags(nodes: TlvNode[], tag: string): TlvNode[] {
  const upper = tag.toUpperCase();
  const out: TlvNode[] = [];
  const walk = (list: TlvNode[]) => {
    for (const n of list) {
      if (n.tag === upper) out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

/** Decode BCD / nibble-packed PAN bytes; stop at filler nibble F. */
export function bcdPanToDigits(bytes: number[]): string {
  let digits = '';
  for (const b of bytes) {
    const hi = (b >> 4) & 0xf;
    const lo = b & 0xf;
    if (hi <= 9) digits += String(hi);
    else break;
    if (lo <= 9) digits += String(lo);
    else break;
  }
  return digits;
}

/** YYMMDD (or YYMM) BCD → { month, year } (full year). */
export function parseExpiryBcd(bytes: number[]): { month: number; year: number } | null {
  if (bytes.length < 2) return null;
  const hex = bytesToHex(bytes);
  const yy = parseInt(hex.slice(0, 2), 10);
  const mm = parseInt(hex.slice(2, 4), 10);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null;
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return { month: mm, year };
}

/**
 * Track 2 Equivalent Data (tag 57): PAN + 'D' + YYMM + …
 * May contain 'F' padding.
 */
export function parseTrack2(bytes: number[]): {
  pan: string;
  expiry: { month: number; year: number } | null;
} {
  const hex = bytesToHex(bytes).replace(/F+$/i, '');
  const dIdx = hex.indexOf('D');
  if (dIdx < 0) {
    return { pan: hex.replace(/\D/g, ''), expiry: null };
  }
  const pan = hex.slice(0, dIdx).replace(/\D/g, '');
  const rest = hex.slice(dIdx + 1);
  const yy = parseInt(rest.slice(0, 2), 10);
  const mm = parseInt(rest.slice(2, 4), 10);
  let expiry: { month: number; year: number } | null = null;
  if (Number.isFinite(yy) && Number.isFinite(mm) && mm >= 1 && mm <= 12) {
    expiry = { month: mm, year: yy >= 70 ? 1900 + yy : 2000 + yy };
  }
  return { pan, expiry };
}
