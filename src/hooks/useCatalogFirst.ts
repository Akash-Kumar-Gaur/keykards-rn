/**
 * Catalog-first hooks — portfolio benefits, checklist, purchase protection.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { mapBenefitRow, type BenefitRow } from '@/lib/cardMappers';
import { CARD_SELECT, mapCardRow, type CardRow } from '@/lib/cardMappers';
import type { CardBenefit, VaultCard } from '@/types/card';
import { computePortfolioInsights } from '@/lib/portfolioInsights';
import {
  pickDefaultSmartSwipeCategory,
  recommendCatalogSmartSwipe,
  SMART_SWIPE_CATEGORIES,
  type CatalogSmartSwipeResult,
} from '@/lib/catalogSmartSwipe';
import { isPurchaseProtectionBenefit } from '@/lib/catalogBenefitParse';
import { currentBenefitPeriodKey } from '@/lib/benefitPeriod';
import type { BenefitCategory } from '@/types/card';
import { useMemo, useState } from 'react';

export type CardWithBenefits = {
  card: VaultCard;
  benefits: CardBenefit[];
};

async function fetchCardsWithBenefits(
  userId: string,
): Promise<CardWithBenefits[]> {
  const { data: cards, error } = await supabase
    .from('cards')
    .select(CARD_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const mapped = ((cards as CardRow[]) ?? []).map(mapCardRow);
  if (mapped.length === 0) return [];

  const ids = mapped.map((c) => c.id);
  const { data: benefits, error: bErr } = await supabase
    .from('card_benefits')
    .select('*')
    .in('card_id', ids);
  if (bErr) throw bErr;
  const byCard = new Map<string, CardBenefit[]>();
  for (const row of (benefits as BenefitRow[]) ?? []) {
    const b = mapBenefitRow(row);
    const list = byCard.get(b.cardId) ?? [];
    list.push(b);
    byCard.set(b.cardId, list);
  }
  return mapped.map((card) => ({
    card,
    benefits: byCard.get(card.id) ?? [],
  }));
}

export function useCardsWithBenefits(userId: string | undefined) {
  return useQuery({
    queryKey: ['cards-with-benefits', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchCardsWithBenefits(userId!),
    staleTime: 30_000,
  });
}

export function usePortfolioInsights(userId: string | undefined) {
  const q = useCardsWithBenefits(userId);
  const insights = useMemo(() => {
    if (!q.data) return null;
    return computePortfolioInsights(
      q.data.map(({ card, benefits }) => ({
        id: card.id,
        nickname: card.nickname,
        annualFee: card.annualFee,
        benefits: benefits.map((b) => ({
          title: b.title,
          category: b.category,
          description: b.description,
          valueEstimate: b.valueEstimate,
        })),
      })),
    );
  }, [q.data]);
  return { ...q, insights };
}

export function useCatalogSmartSwipe(userId: string | undefined) {
  const q = useCardsWithBenefits(userId);
  const [category, setCategory] = useState<BenefitCategory | null>(null);

  const recommendation: CatalogSmartSwipeResult | null = useMemo(() => {
    if (!q.data || q.data.length < 2) return null;
    const inputs = q.data.map(({ card, benefits }) => ({
      id: card.id,
      nickname: card.nickname,
      benefits: benefits.map((b) => ({
        title: b.title,
        category: b.category,
        description: b.description,
        valueEstimate: b.valueEstimate,
      })),
    }));
    const cat = category ?? pickDefaultSmartSwipeCategory(inputs);
    return recommendCatalogSmartSwipe({ cards: inputs, category: cat });
  }, [q.data, category]);

  const activeCategory: BenefitCategory =
    category ??
    recommendation?.categoryKey ??
    pickDefaultSmartSwipeCategory(
      (q.data ?? []).map(({ card, benefits }) => ({
        id: card.id,
        nickname: card.nickname,
        benefits,
      })),
    );

  return {
    ...q,
    category: activeCategory,
    setCategory,
    categories: SMART_SWIPE_CATEGORIES,
    recommendation,
  };
}

export function useBenefitChecklist(userId: string | undefined) {
  const periodKey = currentBenefitPeriodKey();
  const cardsQ = useCardsWithBenefits(userId);
  const checksQ = useQuery({
    queryKey: ['benefit-checklist', userId, periodKey],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefit_checklist_checks')
        .select('benefit_id')
        .eq('user_id', userId!)
        .eq('period_key', periodKey);
      if (error) throw error;
      return new Set((data ?? []).map((r: { benefit_id: string }) => r.benefit_id));
    },
  });

  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (args: {
      benefitId: string;
      cardId: string;
      checked: boolean;
    }) => {
      if (!userId) throw new Error('Not signed in');
      if (args.checked) {
        const { error } = await supabase.from('benefit_checklist_checks').upsert(
          {
            user_id: userId,
            card_id: args.cardId,
            benefit_id: args.benefitId,
            period_key: periodKey,
            checked_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,benefit_id,period_key' },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('benefit_checklist_checks')
          .delete()
          .eq('user_id', userId)
          .eq('benefit_id', args.benefitId)
          .eq('period_key', periodKey);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benefit-checklist', userId, periodKey] });
    },
    onError: (err) => logger.warn('Checklist toggle failed', err),
  });

  return {
    periodKey,
    cards: cardsQ.data ?? [],
    checkedIds: checksQ.data ?? new Set<string>(),
    isLoading: cardsQ.isLoading || checksQ.isLoading,
    toggle,
  };
}

export function useRenewalCalendar(userId: string | undefined) {
  const { data: cards = [], ...rest } = useQuery({
    queryKey: ['renewal-calendar', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cards')
        .select(CARD_SELECT)
        .eq('user_id', userId!);
      if (error) throw error;
      return ((data as CardRow[]) ?? []).map(mapCardRow);
    },
  });

  const events = useMemo(() => {
    type Ev = {
      cardId: string;
      cardNickname: string;
      date: string;
      kind: 'renewal' | 'fee';
      confirmed: boolean;
    };
    const list: Ev[] = [];
    for (const c of cards) {
      const renewal = c.renewalDateConfirmed ?? c.renewalDateEstimated;
      if (renewal) {
        list.push({
          cardId: c.id,
          cardNickname: c.nickname,
          date: renewal,
          kind: 'renewal',
          confirmed: Boolean(c.renewalDateConfirmed),
        });
      }
      if (c.feeDueDate) {
        list.push({
          cardId: c.id,
          cardNickname: c.nickname,
          date: c.feeDueDate,
          kind: 'fee',
          confirmed: true,
        });
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [cards]);

  return { events, cards, ...rest };
}

export function matchPurchaseProtection(benefits: CardBenefit[]) {
  return benefits.filter(isPurchaseProtectionBenefit);
}

export function usePurchaseProtection(userId: string | undefined) {
  const cardsQ = useCardsWithBenefits(userId);
  const logsQ = useQuery({
    queryKey: ['purchase-protection-logs', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_protection_logs')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const qc = useQueryClient();
  const logPurchase = useMutation({
    mutationFn: async (input: {
      cardId: string;
      itemName: string;
      purchaseDate: string;
      price: number;
      notes?: string;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const bundle = cardsQ.data?.find((c) => c.card.id === input.cardId);
      const matches = matchPurchaseProtection(bundle?.benefits ?? []);
      const primary = matches[0];
      const { data, error } = await supabase
        .from('purchase_protection_logs')
        .insert({
          user_id: userId,
          card_id: input.cardId,
          item_name: input.itemName.trim(),
          purchase_date: input.purchaseDate,
          price: input.price,
          notes: input.notes?.trim() || null,
          matched_benefit_title: primary?.title ?? null,
          matched_benefit_summary: primary?.description?.slice(0, 400) ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return { row: data, matches };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-protection-logs', userId] });
    },
  });

  return {
    cards: cardsQ.data ?? [],
    logs: logsQ.data ?? [],
    isLoading: cardsQ.isLoading || logsQ.isLoading,
    logPurchase,
  };
}
