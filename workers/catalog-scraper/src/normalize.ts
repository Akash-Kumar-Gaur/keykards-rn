/**
 * Normalize bank/card names for cross-source discovery dedup.
 * "HDFC Regalia Gold" ≡ "HDFC Bank Regalia Gold Credit Card"
 */

const BANK_ALIASES: Array<{ match: RegExp; canon: string }> = [
  { match: /^hdfc(\s+bank)?$/i, canon: 'hdfc' },
  { match: /^sbi(\s+card)?$/i, canon: 'sbi' },
  { match: /^state\s+bank(\s+of\s+india)?$/i, canon: 'sbi' },
  { match: /^axis(\s+bank)?$/i, canon: 'axis' },
  { match: /^icici(\s+bank)?$/i, canon: 'icici' },
  { match: /^kotak(\s+(mahindra)?(\s+bank)?)?$/i, canon: 'kotak' },
  { match: /^idfc(\s+first)?(\s+bank)?$/i, canon: 'idfc first' },
  { match: /^indusind(\s+bank)?$/i, canon: 'indusind' },
  { match: /^yes(\s+bank)?$/i, canon: 'yes' },
  { match: /^rbl(\s+bank)?$/i, canon: 'rbl' },
  { match: /^federal(\s+bank)?$/i, canon: 'federal' },
  { match: /^standard\s+chartered(\s+bank)?$/i, canon: 'standard chartered' },
  { match: /^american\s+express|amex$/i, canon: 'amex' },
  { match: /^au(\s+small\s+finance)?(\s+bank)?$/i, canon: 'au' },
  { match: /^pnb|punjab\s+national$/i, canon: 'pnb' },
];

export function normalizeBankName(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/\s+(bank|ltd|limited|india)$/g, '').trim();
  for (const a of BANK_ALIASES) {
    if (a.match.test(s)) return a.canon;
  }
  return s;
}

/**
 * Strip common suffixes/prefixes so aggregator vs bank naming collide.
 */
export function normalizeCardName(raw: string, bankName?: string): string {
  let s = raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  s = s
    .replace(/\b(credit|debit)\s+cards?\b/g, '')
    .replace(/\bcards?\b/g, '')
    .replace(/\bco[\s-]?branded\b/g, '')
    .replace(/\bpremium\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (bankName) {
    const bankNorm = normalizeBankName(bankName);
    const bankRaw = bankName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const prefix of [bankNorm, bankRaw, `${bankNorm} bank`, `${bankRaw} bank`]) {
      if (prefix && s.startsWith(prefix + ' ')) {
        s = s.slice(prefix.length).trim();
      }
    }
  }

  // Drop leftover leading "bank"
  s = s.replace(/^bank\s+/, '').trim();
  return s;
}

export function discoveryKey(bankName: string, cardName: string): {
  bank_name_norm: string;
  card_name_norm: string;
} {
  const bank_name_norm = normalizeBankName(bankName);
  const card_name_norm = normalizeCardName(cardName, bankName);
  return { bank_name_norm, card_name_norm };
}
