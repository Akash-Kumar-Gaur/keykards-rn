/**
 * On-device EMV IsoDep reader — PPSE → AID → GPO → READ RECORD → PAN/expiry.
 *
 * All APDU traffic stays on-device. Callers must never log returned PAN digits.
 */

import {
  bcdPanToDigits,
  bytesToHex,
  findAllTags,
  findTag,
  hexToBytes,
  parseExpiryBcd,
  parseTlv,
  parseTrack2,
  type TlvNode,
} from './tlv';
import { buildGpoVariants, parsePdol } from './pdol';
import { classifyPan, type ClassifiedPan } from './panClassify';
import { logger } from '@/lib/logger';

export interface EmvReadResult {
  pan: ClassifiedPan;
  expiryMonth: number | null;
  expiryYear: number | null;
  schemeHint: string | null;
}

const PPSE = '325041592E5359532E4444463031'; // 2PAY.SYS.DDF01

/** Well-known AIDs tried if PPSE yields none. */
const FALLBACK_AIDS: Array<{ aid: string; scheme: string }> = [
  { aid: 'A0000000031010', scheme: 'Visa' },
  { aid: 'A0000000041010', scheme: 'Mastercard' },
  { aid: 'A0000000043060', scheme: 'Maestro' },
  { aid: 'A000000025010801', scheme: 'Amex' },
  { aid: 'A00000002501', scheme: 'Amex' },
  { aid: 'A0000005241010', scheme: 'RuPay' },
  { aid: 'A0000001523010', scheme: 'Diners' },
];

type Transceive = (bytes: number[]) => Promise<number[]>;

function statusWord(resp: number[]): string {
  if (resp.length < 2) return '????';
  const sw1 = resp[resp.length - 2];
  const sw2 = resp[resp.length - 1];
  return `${sw1.toString(16).padStart(2, '0')}${sw2.toString(16).padStart(2, '0')}`;
}

function statusOk(resp: number[]): boolean {
  if (resp.length < 2) return false;
  return resp[resp.length - 2] === 0x90 && resp[resp.length - 1] === 0x00;
}

function bodyOf(resp: number[]): number[] {
  return resp.length >= 2 ? resp.slice(0, -2) : [];
}

function selectByName(nameHex: string): number[] {
  const data = hexToBytes(nameHex);
  return [0x00, 0xa4, 0x04, 0x00, data.length, ...data, 0x00];
}

function readRecordCmd(record: number, sfi: number): number[] {
  const p2 = (sfi << 3) | 0x04;
  return [0x00, 0xb2, record, p2, 0x00];
}

/** AFL entries are 4 bytes: SFI|first|last|offlineAuthRecords */
function parseAfl(afl: number[]): Array<{ sfi: number; first: number; last: number }> {
  const out: Array<{ sfi: number; first: number; last: number }> = [];
  for (let i = 0; i + 3 < afl.length; i += 4) {
    const sfi = afl[i] >> 3;
    const first = afl[i + 1];
    const last = afl[i + 2];
    if (sfi > 0 && first > 0 && last >= first) {
      out.push({ sfi, first, last });
    }
  }
  return out;
}

function extractFromNodes(
  nodes: TlvNode[],
  acc: {
    panRaw: string | null;
    expiry: { month: number; year: number } | null;
  },
) {
  const panTag = findTag(nodes, '5A');
  if (panTag && !acc.panRaw) {
    acc.panRaw = bcdPanToDigits(panTag.value);
  }
  const track = findTag(nodes, '57');
  if (track) {
    const parsed = parseTrack2(track.value);
    if (parsed.pan && !acc.panRaw) acc.panRaw = parsed.pan;
    if (parsed.expiry && !acc.expiry) acc.expiry = parsed.expiry;
  }
  const expTag = findTag(nodes, '5F24');
  if (expTag && !acc.expiry) {
    acc.expiry = parseExpiryBcd(expTag.value);
  }
}

function schemeFromAid(aidHex: string): string | null {
  const upper = aidHex.toUpperCase();
  for (const f of FALLBACK_AIDS) {
    if (upper.startsWith(f.aid.slice(0, 10))) return f.scheme;
  }
  if (upper.startsWith('A000000003')) return 'Visa';
  if (upper.startsWith('A000000004')) return 'Mastercard';
  if (upper.startsWith('A000000025')) return 'Amex';
  if (upper.startsWith('A000000524')) return 'RuPay';
  return null;
}

async function readAflRecords(
  tx: Transceive,
  aflBytes: number[],
  acc: { panRaw: string | null; expiry: { month: number; year: number } | null },
) {
  for (const entry of parseAfl(aflBytes)) {
    for (let rec = entry.first; rec <= entry.last; rec += 1) {
      try {
        const rr = await tx(readRecordCmd(rec, entry.sfi));
        if (!statusOk(rr)) continue;
        extractFromNodes(parseTlv(bodyOf(rr)), acc);
        if (acc.panRaw && acc.expiry) return;
      } catch {
        // continue
      }
    }
  }
}

/** Brute-force a few common SFI/record slots when AFL is missing. */
async function probeCommonRecords(
  tx: Transceive,
  acc: { panRaw: string | null; expiry: { month: number; year: number } | null },
) {
  const probes: Array<{ sfi: number; rec: number }> = [
    { sfi: 1, rec: 1 },
    { sfi: 2, rec: 1 },
    { sfi: 3, rec: 1 },
    { sfi: 4, rec: 1 },
    { sfi: 1, rec: 2 },
    { sfi: 2, rec: 2 },
  ];
  for (const p of probes) {
    try {
      const rr = await tx(readRecordCmd(p.rec, p.sfi));
      if (!statusOk(rr)) continue;
      extractFromNodes(parseTlv(bodyOf(rr)), acc);
      if (acc.panRaw) return;
    } catch {
      // continue
    }
  }
}

async function tryApplication(
  tx: Transceive,
  aidHex: string,
): Promise<EmvReadResult | null> {
  const sel = await tx(selectByName(aidHex));
  if (!statusOk(sel)) {
    logger.info('[EMV] SELECT AID failed', { aid: aidHex.slice(0, 10), sw: statusWord(sel) });
    return null;
  }
  const selBody = bodyOf(sel);
  const selNodes = parseTlv(selBody);

  const acc: {
    panRaw: string | null;
    expiry: { month: number; year: number } | null;
  } = { panRaw: null, expiry: null };

  // Some cards put Track2 / PAN in the SELECT FCI itself.
  extractFromNodes(selNodes, acc);

  const pdolNode = findTag(selNodes, '9F38');
  const pdol = pdolNode?.value ?? null;
  if (pdol) {
    logger.info('[EMV] PDOL tags', {
      tags: parsePdol(pdol).map((e) => `${e.tag}/${e.length}`),
    });
  } else {
    logger.info('[EMV] No PDOL in SELECT FCI');
  }

  // Try filled PDOL variants (Amex 9F6E especially), then empty-PDOL fallback.
  const gpoAttempts = buildGpoVariants(pdol);
  let aflBytes: number[] | null = null;
  let gpoOk = false;

  for (let i = 0; i < gpoAttempts.length; i += 1) {
    const gpoCmd = gpoAttempts[i];
    const gpo = await tx(gpoCmd);
    const sw = statusWord(gpo);
    logger.info('[EMV] GPO', { attempt: i + 1, sw, respLen: gpo.length });
    if (!statusOk(gpo)) continue;

    gpoOk = true;
    const gpoNodes = parseTlv(bodyOf(gpo));
    extractFromNodes(gpoNodes, acc);

    const raw80 = findTag(gpoNodes, '80');
    if (raw80 && raw80.value.length >= 2) {
      aflBytes = raw80.value.slice(2);
    }
    const aflTag = findTag(gpoNodes, '94');
    if (aflTag) aflBytes = aflTag.value;
    break;
  }

  if (!gpoOk && schemeFromAid(aidHex) === 'Amex') {
    logger.info('[EMV] Amex GPO rejected (6985) — card may block non-payment readers');
  }

  if (aflBytes) {
    await readAflRecords(tx, aflBytes, acc);
  } else if (!acc.panRaw) {
    logger.info('[EMV] No AFL — probing common records');
    await probeCommonRecords(tx, acc);
  }

  if (!acc.panRaw && !acc.expiry) return null;

  return {
    pan: classifyPan(acc.panRaw ?? ''),
    expiryMonth: acc.expiry?.month ?? null,
    expiryYear: acc.expiry?.year ?? null,
    schemeHint: schemeFromAid(aidHex),
  };
}

function aidsFromPpse(nodes: TlvNode[]): string[] {
  return findAllTags(nodes, '4F').map((n) => bytesToHex(n.value));
}

/**
 * Run a full EMV read against an open IsoDep session.
 * `transceive` is NfcManager.isoDepHandler.transceive.
 */
export async function readEmvCard(transceive: Transceive): Promise<EmvReadResult> {
  let aidList: string[] = [];

  try {
    const ppse = await transceive(selectByName(PPSE));
    logger.info('[EMV] SELECT PPSE', { sw: statusWord(ppse), len: ppse.length });
    if (statusOk(ppse)) {
      aidList = aidsFromPpse(parseTlv(bodyOf(ppse)));
      logger.info('[EMV] AIDs from PPSE', {
        count: aidList.length,
        prefixes: aidList.map((a) => a.slice(0, 10)),
      });
    }
  } catch {
    // fall through to known AIDs
  }

  if (aidList.length === 0) {
    aidList = FALLBACK_AIDS.map((a) => a.aid);
    logger.info('[EMV] Using fallback AID list');
  }

  let best: EmvReadResult | null = null;
  for (const aid of aidList) {
    try {
      const result = await tryApplication(transceive, aid);
      if (!result) continue;
      if (result.pan.quality === 'full') return result;
      if (!best) best = result;
      else if (best.pan.quality !== 'full' && result.pan.digits.length > best.pan.digits.length) {
        best = result;
      }
    } catch (err) {
      logger.warn('[EMV] AID attempt threw', {
        aid: aid.slice(0, 10),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (best) return best;
  throw new Error('NO_EMV_DATA');
}
