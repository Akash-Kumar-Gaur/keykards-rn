/**
 * Unit tests for milestone cycle period math + progress after reset window.
 */

import {
  addMonthsToIsoDate,
  computeMilestoneProgress,
  todayIsoUtc,
} from './trackDerived';

function nextCycleDates(periodMonths: number, today: Date) {
  const periodStart = todayIsoUtc(today);
  return {
    periodStart,
    periodEnd: addMonthsToIsoDate(periodStart, Math.max(1, periodMonths)),
  };
}

describe('milestone cycle dates', () => {
  it('shifts period forward by catalog months from today', () => {
    const today = new Date(Date.UTC(2026, 6, 25)); // Jul 25 2026
    const { periodStart, periodEnd } = nextCycleDates(12, today);
    expect(periodStart).toBe('2026-07-25');
    expect(periodEnd).toBe(addMonthsToIsoDate('2026-07-25', 12));
    expect(periodEnd).toBe('2027-07-25');
  });

  it('todayIsoUtc is stable UTC date', () => {
    expect(todayIsoUtc(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });
});

describe('computeMilestoneProgress with active cycle periodStart', () => {
  const txns = [
    {
      id: 't1',
      userId: 'u',
      cardId: 'c1',
      amount: 40_000,
      merchantRaw: 'OLD',
      merchantNormalized: 'OLD',
      transactionDate: '2026-01-10',
      source: 'manual' as const,
      sourceConfidence: 'high' as const,
      status: 'confirmed' as const,
      transactionType: 'debit' as const,
      pointsAmount: null,
      pointsExpiryDate: null,
      rawText: null,
      rawTextExpiresAt: null,
      autoFinalizeAt: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't2',
      userId: 'u',
      cardId: 'c1',
      amount: 5_000,
      merchantRaw: 'NEW',
      merchantNormalized: 'NEW',
      transactionDate: '2026-07-26',
      source: 'manual' as const,
      sourceConfidence: 'high' as const,
      status: 'confirmed' as const,
      transactionType: 'debit' as const,
      pointsAmount: null,
      pointsExpiryDate: null,
      rawText: null,
      rawTextExpiresAt: null,
      autoFinalizeAt: null,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('ignores pre-reset spend when periodStart is today after reset', () => {
    const r = computeMilestoneProgress({
      cardId: 'c1',
      cardNickname: 'Test',
      bankName: 'HDFC Bank',
      policy: {
        milestoneThreshold: 150_000,
        milestonePeriodMonths: 12,
        milestoneRewardDescription: 'Reward',
        feeWaiverSpendThreshold: null,
        pointsExpiryPolicyMonths: null,
      },
      manual: {
        target: 150_000,
        current: 0,
        reward: 'Reward',
        periodStart: '2026-07-25',
        periodMonths: 12,
      },
      txns,
    });
    expect(r).not.toBeNull();
    expect(r!.spent).toBe(5_000);
    expect(r!.progress).toBeCloseTo(5000 / 150_000);
  });
});

describe('computeMilestoneProgress with cycleStartedAt cutoff', () => {
  const base = {
    userId: 'u',
    cardId: 'c1',
    merchantRaw: 'M',
    merchantNormalized: 'M',
    source: 'clipboard' as const,
    sourceConfidence: 'high' as const,
    status: 'confirmed' as const,
    transactionType: 'debit' as const,
    pointsAmount: null,
    pointsExpiryDate: null,
    rawText: null,
    rawTextExpiresAt: null,
    autoFinalizeAt: null,
    updatedAt: '',
  };
  // Both dated the day of the reset, but one was recorded before it.
  const sameDayTxns = [
    {
      ...base,
      id: 'before',
      amount: 2_786.8,
      transactionDate: '2026-07-25',
      createdAt: '2026-07-25T14:25:25.324Z',
    },
    {
      ...base,
      id: 'after',
      amount: 1_000,
      transactionDate: '2026-07-25',
      createdAt: '2026-07-25T14:50:00.000Z',
    },
  ];
  const policy = {
    milestoneThreshold: 150_000,
    milestonePeriodMonths: 12,
    milestoneRewardDescription: 'Reward',
    feeWaiverSpendThreshold: null,
    pointsExpiryPolicyMonths: null,
  };

  it('excludes same-day spend recorded before the reset', () => {
    const r = computeMilestoneProgress({
      cardId: 'c1',
      cardNickname: 'Test',
      bankName: 'Axis Bank',
      policy,
      manual: {
        target: 150_000,
        current: 0,
        reward: 'Reward',
        periodStart: '2026-07-25',
        cycleStartedAt: '2026-07-25T14:45:34.457Z',
        periodMonths: 12,
      },
      txns: sameDayTxns,
    });
    expect(r!.spent).toBe(1_000);
  });

  it('counts everything in the window when no cycle has been reset', () => {
    const r = computeMilestoneProgress({
      cardId: 'c1',
      cardNickname: 'Test',
      bankName: 'Axis Bank',
      policy,
      manual: {
        target: 150_000,
        current: 0,
        reward: 'Reward',
        periodStart: '2026-07-25',
        cycleStartedAt: null,
        periodMonths: 12,
      },
      txns: sameDayTxns,
    });
    expect(r!.spent).toBeCloseTo(3_786.8);
  });

  it('shows zero right after a reset with no new spend', () => {
    const r = computeMilestoneProgress({
      cardId: 'c1',
      cardNickname: 'Test',
      bankName: 'Axis Bank',
      policy,
      manual: {
        target: 150_000,
        current: 0,
        reward: 'Reward',
        periodStart: '2026-07-25',
        cycleStartedAt: '2026-07-25T15:00:00.000Z',
        periodMonths: 12,
      },
      txns: sameDayTxns,
    });
    expect(r!.spent).toBe(0);
    expect(r!.progress).toBe(0);
  });
});
