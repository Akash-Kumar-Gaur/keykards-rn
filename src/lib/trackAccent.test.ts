/**
 * Track accent / snapshot filter — pure helpers for card-scope theming.
 */

import {
  accentPairFromThemeId,
  defaultTrackAccent,
  filterTrackSnapshot,
  hexToSoft,
  TRACK_DEFAULT_ACCENT,
} from './trackAccent';
import { getCardTheme } from './cardThemes';
import { palette } from '@/theme';
import type { TrackSnapshot } from '@/types/track';

function emptySnapshot(partial: Partial<TrackSnapshot> = {}): TrackSnapshot {
  return {
    milestones: [],
    feePayback: [],
    pointsExpiring: [],
    renewals: [],
    pendingCount: 0,
    gmailConnected: false,
    ...partial,
  };
}

describe('hexToSoft', () => {
  it('builds rgba from hex', () => {
    expect(hexToSoft('#6B1E2A', 0.16)).toBe('rgba(107, 30, 42, 0.16)');
  });
});

describe('accentPairFromThemeId', () => {
  it('returns default indigo when null (All cards)', () => {
    const pair = accentPairFromThemeId(null);
    expect(pair.accent).toBe(TRACK_DEFAULT_ACCENT);
    expect(pair.accentDeep).toBe(palette.indigoDeep);
  });

  it('resolves three distinct bank themes for animated transitions', () => {
    const themes = ['hdfc-maroon', 'sbi-indigo', 'icici-amber'] as const;
    const pairs = themes.map((t) => accentPairFromThemeId(t));

    // Each theme’s first stop must differ so interpolateColor has a visible path.
    const accents = new Set(pairs.map((p) => p.accent));
    expect(accents.size).toBe(3);

    for (let i = 0; i < themes.length; i++) {
      const preset = getCardTheme(themes[i]);
      expect(pairs[i]!.accent).toBe(preset.colors[0]);
      expect(pairs[i]!.accentDeep).toBe(preset.colors[1]);
      expect(pairs[i]!.accentSoft).toContain('rgba');
    }
  });

  it('reverts to default indigo after a card theme (All cards path)', () => {
    const card = accentPairFromThemeId('kotak-crimson');
    const all = defaultTrackAccent();
    expect(card.accent).not.toBe(all.accent);
    expect(all.accent).toBe(palette.indigo);
  });
});

describe('filterTrackSnapshot', () => {
  const snap = emptySnapshot({
    milestones: [
      {
        cardId: 'a',
        cardNickname: 'A',
        bankName: 'X',
        spent: 1,
        threshold: 10,
        remaining: 9,
        periodMonths: 12,
        rewardDescription: 'r',
        progress: 0.1,
        source: 'manual_milestone',
      },
      {
        cardId: 'b',
        cardNickname: 'B',
        bankName: 'Y',
        spent: 2,
        threshold: 10,
        remaining: 8,
        periodMonths: 12,
        rewardDescription: 'r',
        progress: 0.2,
        source: 'manual_milestone',
      },
    ],
    renewals: [
      {
        cardId: 'a',
        cardNickname: 'A',
        bankName: 'X',
        renewalDate: '2026-12-01',
        isConfirmed: true,
        daysUntil: 30,
      },
    ],
    feePayback: [
      {
        cardId: 'b',
        cardNickname: 'B',
        bankName: 'Y',
        annualFee: 1000,
        benefitValueSum: 500,
        paybackRatio: 0.5,
        periodSpend: 0,
        likelyWaiver: false,
      },
    ],
    pointsExpiring: [
      {
        id: 'p1',
        cardId: 'a',
        cardNickname: 'A',
        bankName: 'X',
        pointsAmount: 100,
        expiryDate: '2026-08-01',
        daysUntil: 10,
      },
    ],
  });

  it('passes through when All cards (null)', () => {
    expect(filterTrackSnapshot(snap, null)).toBe(snap);
  });

  it('keeps only the selected card across every section', () => {
    const scoped = filterTrackSnapshot(snap, 'a');
    expect(scoped.milestones).toHaveLength(1);
    expect(scoped.milestones[0]!.cardId).toBe('a');
    expect(scoped.renewals).toHaveLength(1);
    expect(scoped.feePayback).toHaveLength(0);
    expect(scoped.pointsExpiring).toHaveLength(1);
  });
});

/**
 * Documents the accent transition sequence requested for PART 3 QA:
 * All → theme1 → theme2 → theme3 → All. Colors must change at each step
 * and land back on indigo.
 */
describe('Track accent transition sequence', () => {
  it('switches cleanly across 3 card themes and back to All', () => {
    const sequence = [
      defaultTrackAccent(),
      accentPairFromThemeId('hdfc-maroon'),
      accentPairFromThemeId('amex-gunmetal'),
      accentPairFromThemeId('generic-emerald'),
      defaultTrackAccent(),
    ];

    expect(sequence[0]!.accent).toBe(palette.indigo);
    expect(sequence[1]!.accent).toBe(getCardTheme('hdfc-maroon').colors[0]);
    expect(sequence[2]!.accent).toBe(getCardTheme('amex-gunmetal').colors[0]);
    expect(sequence[3]!.accent).toBe(getCardTheme('generic-emerald').colors[0]);
    expect(sequence[4]!.accent).toBe(palette.indigo);

    // Adjacent steps must differ so Reanimated interpolateColor animates.
    for (let i = 0; i < sequence.length - 1; i++) {
      expect(sequence[i]!.accent).not.toBe(sequence[i + 1]!.accent);
    }
  });
});
