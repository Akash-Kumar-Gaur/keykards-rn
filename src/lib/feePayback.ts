export type FeePaybackPresentation = {
  safeFee: number;
  benefitValue: number;
  ratio: number;
  progress: number;
  remaining: number;
  headline: string;
  summary: string;
};

/**
 * Normalizes fee-payback data for every UI surface. Handles zero/negative,
 * over-fee, and very large values without Infinity/NaN leaking into layout.
 */
export function feePaybackPresentation(
  annualFee: number,
  benefitValue: number,
  formatMoney: (value: number) => string,
): FeePaybackPresentation {
  const safeFee = Number.isFinite(annualFee) ? Math.max(0, annualFee) : 0;
  const safeBenefit = Number.isFinite(benefitValue)
    ? Math.max(0, benefitValue)
    : 0;
  const ratio = safeFee > 0 ? safeBenefit / safeFee : 0;
  const progress = Math.min(1, ratio);
  const remaining = Math.max(0, safeFee - safeBenefit);

  if (safeFee === 0) {
    return {
      safeFee,
      benefitValue: safeBenefit,
      ratio,
      progress,
      remaining,
      headline: 'No fee',
      summary: 'This card has no annual fee to recover',
    };
  }

  const headline =
    ratio >= 2 ? `${ratio.toFixed(1)}×` : `${Math.round(ratio * 100)}%`;
  return {
    safeFee,
    benefitValue: safeBenefit,
    ratio,
    progress,
    remaining,
    headline,
    summary:
      remaining > 0
        ? `${formatMoney(remaining)} short of the ${formatMoney(safeFee)} fee`
        : `Estimated benefits cover the ${formatMoney(safeFee)} fee`,
  };
}
