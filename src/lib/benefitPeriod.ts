/**
 * Current checklist period key — calendar quarter, e.g. "2026-Q3".
 * Aligns with lounge benefits that reset quarterly.
 */

export function currentBenefitPeriodKey(now = new Date()): string {
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
}

export function formatPeriodLabel(periodKey: string): string {
  const m = periodKey.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return periodKey;
  const year = m[1];
  const q = Number(m[2]);
  const months = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];
  return `${months[q - 1]} ${year}`;
}
