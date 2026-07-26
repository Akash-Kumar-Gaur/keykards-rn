/**
 * Catalog scrape review — admin-only hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { mapBenefitCategory } from '@/lib/catalogReviewMap';
import type { BenefitCategory, CardColorTheme, CardNetwork } from '@/types/card';

export type ScrapeLogStatus =
  | 'success'
  | 'parse_failed'
  | 'fetch_failed'
  | 'low_confidence';

export type KnownCardExtractionStatus =
  | 'pending'
  | 'extracted'
  | 'failed'
  | 'skipped';

export interface ScrapeLogRow {
  id: string;
  runAt: string;
  sourceUrl: string | null;
  bankName: string | null;
  cardName: string | null;
  status: ScrapeLogStatus;
  confidence: string | null;
  rawSnippet: string | null;
  proposedJson: Record<string, unknown> | null;
  errorMessage: string | null;
  reviewedAt: string | null;
  reviewedAction: string | null;
}

export interface KnownCardRow {
  id: string;
  bankName: string;
  cardName: string;
  cardType: 'credit' | 'debit';
  detailUrl: string;
  discoveredFrom: string;
  firstSeenAt: string;
  lastSeenAt: string;
  extractionStatus: KnownCardExtractionStatus;
  failureCount: number;
  lastError: string | null;
  cardCatalogId: string | null;
}

export interface KnownCardsCounts {
  pending: number;
  extracted: number;
  failed: number;
  skipped: number;
}

export const scrapeLogKeys = {
  review: ['catalog_scrape_log', 'review'] as const,
  discovery: ['known_cards', 'discovery'] as const,
  discoveryCounts: ['known_cards', 'counts'] as const,
};

function mapLog(row: Record<string, unknown>): ScrapeLogRow {
  return {
    id: row.id as string,
    runAt: row.run_at as string,
    sourceUrl: (row.source_url as string) ?? null,
    bankName: (row.bank_name as string) ?? null,
    cardName: (row.card_name as string) ?? null,
    status: row.status as ScrapeLogStatus,
    confidence: (row.confidence as string) ?? null,
    rawSnippet: (row.raw_snippet as string) ?? null,
    proposedJson: (row.proposed_json as Record<string, unknown>) ?? null,
    errorMessage: (row.error_message as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
    reviewedAction: (row.reviewed_action as string) ?? null,
  };
}

function mapKnown(row: Record<string, unknown>): KnownCardRow {
  return {
    id: row.id as string,
    bankName: row.bank_name as string,
    cardName: row.card_name as string,
    cardType: row.card_type as 'credit' | 'debit',
    detailUrl: row.detail_url as string,
    discoveredFrom: row.discovered_from as string,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
    extractionStatus: row.extraction_status as KnownCardExtractionStatus,
    failureCount: Number(row.failure_count ?? 0),
    lastError: (row.last_error as string) ?? null,
    cardCatalogId: (row.card_catalog_id as string) ?? null,
  };
}

export function useScrapeReviewQueue(enabled: boolean) {
  return useQuery({
    queryKey: scrapeLogKeys.review,
    enabled,
    queryFn: async (): Promise<ScrapeLogRow[]> => {
      const { data, error } = await supabase
        .from('catalog_scrape_log')
        .select('*')
        .in('status', ['low_confidence', 'parse_failed', 'fetch_failed'])
        .is('reviewed_at', null)
        .order('run_at', { ascending: false })
        .limit(50);
      if (error) {
        logger.warn('Failed to load scrape review queue', error);
        throw error;
      }
      return (data ?? []).map((r) => mapLog(r as Record<string, unknown>));
    },
  });
}

export function useKnownCardsCounts(enabled: boolean) {
  return useQuery({
    queryKey: scrapeLogKeys.discoveryCounts,
    enabled,
    queryFn: async (): Promise<KnownCardsCounts> => {
      const counts: KnownCardsCounts = {
        pending: 0,
        extracted: 0,
        failed: 0,
        skipped: 0,
      };
      for (const status of Object.keys(counts) as Array<keyof KnownCardsCounts>) {
        const { count, error } = await supabase
          .from('known_cards')
          .select('id', { count: 'exact', head: true })
          .eq('extraction_status', status);
        if (error) {
          logger.warn('Failed to count known_cards', error);
          throw error;
        }
        counts[status] = count ?? 0;
      }
      return counts;
    },
  });
}

export function useKnownCardsQueue(
  enabled: boolean,
  statusFilter: KnownCardExtractionStatus | 'all' = 'failed',
) {
  return useQuery({
    queryKey: [...scrapeLogKeys.discovery, statusFilter],
    enabled,
    queryFn: async (): Promise<KnownCardRow[]> => {
      let q = supabase
        .from('known_cards')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(80);
      if (statusFilter !== 'all') {
        q = q.eq('extraction_status', statusFilter);
      }
      const { data, error } = await q;
      if (error) {
        logger.warn('Failed to load known_cards', error);
        throw error;
      }
      return (data ?? []).map((r) => mapKnown(r as Record<string, unknown>));
    },
  });
}

export function useSetKnownCardStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      status: KnownCardExtractionStatus;
    }) => {
      const { error } = await supabase
        .from('known_cards')
        .update({
          extraction_status: payload.status,
          updated_at: new Date().toISOString(),
          ...(payload.status === 'pending'
            ? { failure_count: 0, last_error: null }
            : {}),
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scrapeLogKeys.discovery });
      qc.invalidateQueries({ queryKey: scrapeLogKeys.discoveryCounts });
    },
  });
}

export interface ApprovePayload {
  logId: string;
  bankName: string;
  cardName: string;
  network: CardNetwork;
  annualFee: number | null;
  cardColorTheme: CardColorTheme;
  sourceUrl: string | null;
  benefits: Array<{
    title: string;
    category: BenefitCategory;
    description: string;
    value_estimate: number | null;
  }>;
  edited: boolean;
}

export function useApproveScrapeLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApprovePayload) => {
      const row = {
        bank_name: payload.bankName,
        card_name: payload.cardName,
        network: payload.network,
        default_annual_fee: payload.annualFee,
        card_color_theme: payload.cardColorTheme,
        default_color_theme: payload.cardColorTheme,
        default_benefits: payload.benefits,
        source: 'manual',
        last_verified_at: new Date().toISOString(),
        raw_source_url: payload.sourceUrl,
      };

      const existing = await supabase
        .from('card_catalog')
        .select('id, source')
        .eq('bank_name', payload.bankName)
        .eq('card_name', payload.cardName)
        .maybeSingle();

      if (existing.error) throw existing.error;

      if (existing.data?.id) {
        const { error } = await supabase
          .from('card_catalog')
          .update(row)
          .eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('card_catalog').insert(row);
        if (error) throw error;
      }

      const { error: logErr } = await supabase
        .from('catalog_scrape_log')
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_action: payload.edited ? 'edited' : 'approved',
        })
        .eq('id', payload.logId);
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scrapeLogKeys.review });
      qc.invalidateQueries({ queryKey: ['card_catalog'] });
    },
  });
}

export function useRejectScrapeLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from('catalog_scrape_log')
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_action: 'rejected',
        })
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scrapeLogKeys.review });
    },
  });
}

/** Parse proposed_json benefits into catalog shape. */
export function proposedToBenefits(
  proposed: Record<string, unknown> | null,
): ApprovePayload['benefits'] {
  if (!proposed) return [];
  const list = proposed.benefits;
  if (!Array.isArray(list)) return [];
  return list
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({
      title: String(b.title ?? ''),
      category: mapBenefitCategory(String(b.category ?? 'other')),
      description: String(b.description ?? ''),
      value_estimate:
        b.value_estimate === null || b.value_estimate === undefined
          ? null
          : Number(b.value_estimate),
    }))
    .filter((b) => b.title.trim().length > 0);
}
