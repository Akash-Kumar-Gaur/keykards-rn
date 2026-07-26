/**
 * Shared card_catalog — Benefit Radar seed, read-only for authenticated users.
 */

import { useQuery } from '@tanstack/react-query';
import { DEFAULT_CARD_THEME, isValidCardTheme } from '@/lib/cardThemes';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  BenefitCategory,
  CardCatalogEntry,
  CardColorTheme,
  CardNetwork,
  CatalogBenefitSeed,
} from '@/types/card';

type CatalogRow = {
  id: string;
  bank_name: string;
  card_name: string;
  network: string;
  default_benefits: CatalogBenefitSeed[] | null;
  default_annual_fee: number | string | null;
  card_color_theme: string;
  default_color_theme: string | null;
};

function resolveTheme(...candidates: Array<string | null | undefined>): CardColorTheme {
  for (const c of candidates) {
    if (c && isValidCardTheme(c)) return c;
  }
  return DEFAULT_CARD_THEME;
}

function mapCatalog(row: CatalogRow): CardCatalogEntry {
  const fee =
    row.default_annual_fee === null || row.default_annual_fee === undefined
      ? null
      : Number(row.default_annual_fee);
  const theme = resolveTheme(row.default_color_theme, row.card_color_theme);
  return {
    id: row.id,
    bankName: row.bank_name,
    cardName: row.card_name,
    network: row.network as CardNetwork,
    defaultBenefits: (row.default_benefits ?? []).map((b) => ({
      title: b.title,
      category: b.category as BenefitCategory,
      description: b.description ?? '',
      value_estimate:
        b.value_estimate === null || b.value_estimate === undefined
          ? null
          : Number(b.value_estimate),
    })),
    defaultAnnualFee: Number.isFinite(fee as number) ? (fee as number) : null,
    cardColorTheme: theme,
    defaultColorTheme: theme,
  };
}

export const catalogKeys = {
  all: ['card_catalog'] as const,
};

export function useCardCatalog() {
  return useQuery({
    queryKey: catalogKeys.all,
    queryFn: async (): Promise<CardCatalogEntry[]> => {
      const { data, error } = await supabase
        .from('card_catalog')
        .select(
          'id, bank_name, card_name, network, default_benefits, default_annual_fee, card_color_theme, default_color_theme',
        )
        .order('bank_name', { ascending: true })
        .order('card_name', { ascending: true });
      if (error) {
        logger.warn('Failed to load card catalog', error);
        throw error;
      }
      return (data as CatalogRow[] | null)?.map(mapCatalog) ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function filterCatalog(
  entries: CardCatalogEntry[],
  query: string,
): CardCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) =>
      e.bankName.toLowerCase().includes(q) ||
      e.cardName.toLowerCase().includes(q) ||
      e.network.toLowerCase().includes(q),
  );
}
