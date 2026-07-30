/**
 * On-demand live catalog search via search-card-live Edge Function.
 */

import { supabase } from '@/lib/supabase';
import { DEFAULT_CARD_THEME, isValidCardTheme } from '@/lib/cardThemes';
import type {
  BenefitCategory,
  CardCatalogEntry,
  CardColorTheme,
  CardNetwork,
  CatalogBenefitSeed,
} from '@/types/card';

export type LiveSearchResult =
  | {
      ok: true;
      source: 'catalog' | 'cache' | 'live';
      entry: CardCatalogEntry;
      message?: string;
      needsReview?: boolean;
      confidence?: string;
    }
  | {
      ok: false;
      error: string;
      fallbackManual: boolean;
      detail?: string;
    };

type LiveEntryPayload = {
  id?: string;
  bankName?: string;
  cardName?: string;
  network?: string;
  defaultAnnualFee?: number | null;
  defaultBenefits?: CatalogBenefitSeed[];
  defaultColorTheme?: string;
  source?: string;
};

function mapEntry(raw: LiveEntryPayload): CardCatalogEntry | null {
  if (!raw.bankName || !raw.cardName) return null;
  const themeRaw = raw.defaultColorTheme;
  const theme: CardColorTheme =
    themeRaw && isValidCardTheme(themeRaw) ? themeRaw : DEFAULT_CARD_THEME;
  const network = (raw.network ?? 'Visa') as CardNetwork;
  return {
    id: raw.id ?? `live-${Date.now()}`,
    bankName: raw.bankName,
    cardName: raw.cardName,
    network,
    defaultBenefits: (raw.defaultBenefits ?? []).map((b) => ({
      title: b.title,
      category: b.category as BenefitCategory,
      description: b.description ?? '',
      value_estimate:
        b.value_estimate === null || b.value_estimate === undefined
          ? null
          : Number(b.value_estimate),
      period_raw: b.period_raw ?? null,
    })),
    defaultAnnualFee:
      raw.defaultAnnualFee === null || raw.defaultAnnualFee === undefined
        ? null
        : Number(raw.defaultAnnualFee),
    cardColorTheme: theme,
    defaultColorTheme: theme,
    source:
      raw.source === 'manual' || raw.source === 'needs_review' || raw.source === 'auto'
        ? raw.source
        : 'auto',
  };
}

export async function searchCardLive(
  bankName: string,
  cardName: string,
): Promise<LiveSearchResult> {
  const { data, error } = await supabase.functions.invoke('search-card-live', {
    body: {
      bank_name: bankName.trim(),
      card_name: cardName.trim(),
      publish: true,
    },
  });

  if (error) {
    return {
      ok: false,
      error: error.message || 'Live search failed',
      fallbackManual: true,
    };
  }

  const payload = data as Record<string, unknown> | null;
  if (!payload) {
    return {
      ok: false,
      error: 'Empty response from live search',
      fallbackManual: true,
    };
  }

  if (payload.ok === false) {
    return {
      ok: false,
      error: String(payload.error ?? 'Couldn’t find this card'),
      fallbackManual: payload.fallback_manual !== false,
      detail: payload.detail != null ? String(payload.detail) : undefined,
    };
  }

  const entry = mapEntry((payload.entry ?? {}) as LiveEntryPayload);
  if (!entry || entry.defaultBenefits.length === 0) {
    return {
      ok: false,
      error: 'No usable benefits returned. Enter details manually.',
      fallbackManual: true,
    };
  }

  return {
    ok: true,
    source: (payload.source as 'catalog' | 'cache' | 'live') ?? 'live',
    entry,
    message:
      typeof payload.message === 'string'
        ? payload.message
        : `Here’s what we found for ${entry.cardName} — does this look right?`,
    needsReview: Boolean(payload.needs_review),
    confidence:
      typeof payload.confidence === 'string' ? payload.confidence : undefined,
  };
}

/** Heuristic split of a free-text catalog query into bank + card. */
export function splitBankCardQuery(query: string): {
  bankName: string;
  cardName: string;
} {
  const q = query.trim().replace(/\s+/g, ' ');
  if (!q) return { bankName: '', cardName: '' };

  const banks = [
    'hdfc bank',
    'hdfc',
    'icici bank',
    'icici',
    'sbi card',
    'sbi',
    'axis bank',
    'axis',
    'kotak mahindra bank',
    'kotak',
    'idfc first bank',
    'idfc first',
    'idfc',
    'indusind bank',
    'indusind',
    'yes bank',
    'rbl bank',
    'rbl',
    'standard chartered',
    'amex',
    'american express',
    'bank of baroda',
    'bob',
    'bobcard',
    'punjab national bank',
    'pnb',
    'federal bank',
    'scapia',
    'au small finance bank',
    'au bank',
    'citi',
  ];

  const lower = q.toLowerCase();
  for (const b of banks) {
    if (lower.startsWith(b + ' ') || lower === b) {
      return {
        bankName: q.slice(0, b.length),
        cardName: q.slice(b.length).trim() || q,
      };
    }
  }

  const parts = q.split(' ');
  if (parts.length >= 2) {
    return { bankName: parts[0]!, cardName: parts.slice(1).join(' ') };
  }
  return { bankName: '', cardName: q };
}
