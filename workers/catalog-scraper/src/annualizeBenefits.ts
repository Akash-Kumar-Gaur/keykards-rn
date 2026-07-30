/**
 * Normalize benefit value_estimate to an ANNUAL INR figure.
 *
 * LLMs often return the monthly/quarterly cap as value_estimate even when the
 * prompt asks for annual. This post-processor:
 *  - attaches period_raw for verification
 *  - annualizes obvious monthly/quarterly caps when the stored value matches
 *    the stated period figure (or stated×uses-per-period)
 *  - flags implausible annuals vs card fee for needs_review
 */

export type BenefitWithValue = {
  title: string;
  category: string;
  description: string;
  value_estimate: number | null;
  period_raw?: string | null;
};

export type AnnualizeResult = {
  benefits: BenefitWithValue[];
  /** True when any single benefit's annual estimate exceeds fee × multiplier. */
  implausibleVsFee: boolean;
  flags: string[];
};

const FEE_MULTIPLIER_FLAG = 10;

function extractMoneyAmounts(text: string): number[] {
  const amounts: number[] = [];
  const re = /₹\s*([\d,]+(?:\.\d+)?)|Rs\.?\s*([\d,]+(?:\.\d+)?)|INR\s*([\d,]+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').replace(/,/g, '');
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) amounts.push(n);
  }
  return amounts;
}

function usesPerMonth(text: string): number {
  const twice = /(?:two|2)\s+times?\s+per\s+month|twice\s+(?:a|per)\s+month|valid\s+two\s+times\s+per\s+month/i;
  if (twice.test(text)) return 2;
  const nTimes = text.match(/(\d+)\s+times?\s+per\s+month/i);
  if (nTimes) return Number(nTimes[1]);
  return 1;
}

/**
 * If description clearly states a monthly/quarterly rupee benefit and
 * value_estimate equals that period figure (not annualized), multiply up.
 */
export function annualizeBenefitValue(
  benefit: BenefitWithValue,
): BenefitWithValue {
  if (benefit.value_estimate == null || !Number.isFinite(benefit.value_estimate)) {
    return benefit;
  }
  const text = `${benefit.title} ${benefit.description}`;
  const value = benefit.value_estimate;
  const amounts = extractMoneyAmounts(text);

  const monthly =
    /(per|each|a|every)\s+month|\/\s*mo(?:nth)?|monthly|each month|per calendar month/i.test(
      text,
    );
  const quarterly =
    /(per|each|a|every)\s+quarter|\/\s*quarter|quarterly|per statement quarter/i.test(
      text,
    );
  const oneTime =
    /first\s+\d+\s+days|welcome|one[\s-]?time|activation|joining/i.test(text);

  if (oneTime) {
    return {
      ...benefit,
      period_raw: benefit.period_raw ?? `₹${value} one-time`,
    };
  }

  if (monthly) {
    const uses = usesPerMonth(text);
    // Stated per-use amount × uses (e.g. ₹120 × 2 = ₹240/month)
    for (const amt of amounts) {
      const monthlyTotal = amt * uses;
      if (Math.abs(value - monthlyTotal) < 1 || Math.abs(value - amt) < 1) {
        const annual = Math.round(monthlyTotal * 12);
        // Only rewrite when value looks like the period figure, not already annual
        if (value < annual * 0.5) {
          return {
            ...benefit,
            value_estimate: annual,
            period_raw:
              benefit.period_raw ??
              (uses > 1
                ? `₹${amt}×${uses}/month`
                : `₹${monthlyTotal}/month`),
          };
        }
      }
    }
    // value equals a stated amount that is clearly a monthly cap
    if (
      amounts.some((a) => Math.abs(a - value) < 1) &&
      value * 12 > value * 1.5
    ) {
      return {
        ...benefit,
        value_estimate: Math.round(value * 12),
        period_raw: benefit.period_raw ?? `₹${value}/month`,
      };
    }
  }

  if (quarterly) {
    for (const amt of amounts) {
      if (Math.abs(value - amt) < 1) {
        return {
          ...benefit,
          value_estimate: Math.round(value * 4),
          period_raw: benefit.period_raw ?? `₹${value}/quarter`,
        };
      }
    }
  }

  return {
    ...benefit,
    period_raw:
      benefit.period_raw ??
      (monthly
        ? `stated monthly context; stored ₹${value} (assumed annual)`
        : null),
  };
}

export function normalizeExtractionBenefits(
  benefits: BenefitWithValue[],
  annualFee: number | null,
): AnnualizeResult {
  const normalized = benefits.map(annualizeBenefitValue);
  const flags: string[] = [];
  let implausibleVsFee = false;

  if (annualFee != null && annualFee > 0) {
    for (const b of normalized) {
      if (
        b.value_estimate != null &&
        b.value_estimate > annualFee * FEE_MULTIPLIER_FLAG
      ) {
        implausibleVsFee = true;
        flags.push(
          `"${b.title}" value_estimate ₹${b.value_estimate} is >${FEE_MULTIPLIER_FLAG}× annual fee ₹${annualFee}`,
        );
      }
    }
  }

  return { benefits: normalized, implausibleVsFee, flags };
}

export { FEE_MULTIPLIER_FLAG };
