/**
 * Known bank alert / statement sender domains for Gmail filtering.
 * Expand as more banks are added — keep aligned with catalog banks.
 */

export const BANK_SENDER_DOMAINS: Record<string, string[]> = {
  'HDFC Bank': [
    'hdfcbank.net',
    'hdfcbank.com',
    'alerts.hdfcbank.net',
    'echannel.hdfcbank.com',
  ],
  'SBI Card': [
    'sbicard.com',
    'sbi.co.in',
    'alerts.sbicard.com',
  ],
  'Axis Bank': [
    'axisbank.com',
    'axisbank.co.in',
    'alerts.axisbank.com',
  ],
  'ICICI Bank': [
    'icicibank.com',
    'imail.icicibank.com',
    'alerts.icicibank.com',
  ],
};

/** Flat unique domain list for Gmail query construction. */
export function allBankSenderDomains(): string[] {
  const set = new Set<string>();
  for (const domains of Object.values(BANK_SENDER_DOMAINS)) {
    for (const d of domains) set.add(d.toLowerCase());
  }
  return [...set];
}

export function gmailBankQuery(afterDays = 14): string {
  const domains = allBankSenderDomains();
  const fromClause = domains.map((d) => `from:${d}`).join(' OR ');
  return `(${fromClause}) newer_than:${afterDays}d`;
}
