/**
 * Vault card CRUD — encrypts PAN/CVV client-side before any Supabase write.
 * Plaintext never appears in the network request body.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { encryptField } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import {
  CARD_SELECT,
  mapBenefitRow,
  mapCardRow,
  mapMilestoneRow,
  type BenefitRow,
  type CardRow,
  type MilestoneRow,
} from '@/lib/cardMappers';
import {
  clearCardTxnLinkBlocked,
  fetchPendingSyncForCard,
  trackKeys,
} from '@/hooks/useTransactions';
import {
  digitsOnly,
  isValidCvv,
  isValidLuhn,
  lastFourFromNumber,
} from '@/lib/cardUtils';
import { estimateRenewalFromOpenedApprox } from '@/lib/trackDerived';
import {
  mapMilestoneCycleRow,
  type MilestoneCycle,
  type MilestoneCycleRow,
} from '@/lib/milestoneReset';
import type {
  BenefitFormInput,
  CardFormInput,
  CardMilestone,
  CardBenefit,
  MilestoneFormInput,
  VaultCard,
} from '@/types/card';
import { hasStoredCvv } from '@/types/card';

export const cardKeys = {
  all: ['cards'] as const,
  list: (userId: string) => ['cards', 'list', userId] as const,
  detail: (cardId: string) => ['cards', 'detail', cardId] as const,
  benefits: (cardId: string) => ['cards', 'benefits', cardId] as const,
  milestones: (cardId: string) => ['cards', 'milestones', cardId] as const,
  milestoneCyclesRoot: ['cards', 'milestone-cycles'] as const,
  milestoneCycles: (milestoneId: string) =>
    ['cards', 'milestone-cycles', milestoneId] as const,
};

async function encryptCardSecrets(input: CardFormInput) {
  const pan = digitsOnly(input.cardNumber);
  if (!isValidLuhn(pan)) {
    throw new Error('Enter a valid card number.');
  }
  const panEnc = await encryptField(pan);

  let cvvEnc: Awaited<ReturnType<typeof encryptField>> | null = null;
  if (input.storeCvv) {
    if (!isValidCvv(input.cvv, input.network)) {
      throw new Error('Enter a valid CVV (3–4 digits).');
    }
    cvvEnc = await encryptField(digitsOnly(input.cvv));
  }

  return {
    last_four: lastFourFromNumber(pan),
    card_number_encrypted: panEnc.ciphertext,
    card_number_iv: panEnc.iv,
    card_number_auth_tag: panEnc.authTag,
    cvv_encrypted: cvvEnc?.ciphertext ?? null,
    cvv_iv: cvvEnc?.iv ?? null,
    cvv_auth_tag: cvvEnc?.authTag ?? null,
  };
}

function metaPayload(input: CardFormInput) {
  const opened = input.cardOpenedApprox?.trim() || null;
  const estimated = opened ? estimateRenewalFromOpenedApprox(opened) : null;
  const holder = input.cardholderName.trim() || null;
  return {
    nickname: input.nickname.trim(),
    bank_name: input.bankName.trim(),
    network: input.network,
    cardholder_name: holder,
    expiry_month: input.expiryMonth,
    expiry_year: input.expiryYear,
    card_color_theme: input.cardColorTheme,
    annual_fee: input.annualFee,
    fee_due_date: input.feeDueDate,
    card_opened_approx: opened,
    ...(estimated ? { renewal_date_estimated: estimated } : {}),
  };
}

export function useCards(userId: string | undefined) {
  return useQuery({
    queryKey: cardKeys.list(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<VaultCard[]> => {
      const { data, error } = await supabase
        .from('cards')
        .select(CARD_SELECT)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) {
        logger.warn('Failed to load cards', error);
        throw error;
      }
      return (data as CardRow[] | null)?.map(mapCardRow) ?? [];
    },
    staleTime: 20_000,
    // Persisted cache paints immediately offline; network refresh is background.
    networkMode: 'offlineFirst',
  });
}

export function useCard(cardId: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: cardKeys.detail(cardId ?? ''),
    enabled: Boolean(cardId),
    queryFn: async (): Promise<VaultCard> => {
      const { data, error } = await supabase
        .from('cards')
        .select(CARD_SELECT)
        .eq('id', cardId!)
        .single();
      if (error) {
        logger.warn('Failed to load card', error);
        throw error;
      }
      return mapCardRow(data as CardRow);
    },
    networkMode: 'offlineFirst',
    // Prefer the already-cached list row so Detail never waits on the network.
    placeholderData: () => {
      if (!cardId) return undefined;
      const lists = qc.getQueriesData<VaultCard[]>({ queryKey: ['cards', 'list'] });
      for (const [, list] of lists) {
        const hit = list?.find((c) => c.id === cardId);
        if (hit) return hit;
      }
      return undefined;
    },
  });
}

export function useCardBenefits(cardId: string | undefined) {
  return useQuery({
    queryKey: cardKeys.benefits(cardId ?? ''),
    enabled: Boolean(cardId),
    queryFn: async (): Promise<CardBenefit[]> => {
      const { data, error } = await supabase
        .from('card_benefits')
        .select('*')
        .eq('card_id', cardId!)
        .order('created_at', { ascending: true });
      if (error) {
        logger.warn('Failed to load benefits', error);
        throw error;
      }
      return (data as BenefitRow[] | null)?.map(mapBenefitRow) ?? [];
    },
  });
}

export function useCardMilestones(cardId: string | undefined) {
  return useQuery({
    queryKey: cardKeys.milestones(cardId ?? ''),
    enabled: Boolean(cardId),
    queryFn: async (): Promise<CardMilestone[]> => {
      const { data, error } = await supabase
        .from('card_milestones')
        .select('*')
        .eq('card_id', cardId!)
        .order('period_end', { ascending: true });
      if (error) {
        logger.warn('Failed to load milestones', error);
        throw error;
      }
      return (data as MilestoneRow[] | null)?.map(mapMilestoneRow) ?? [];
    },
  });
}

function invalidateCardQueries(
  qc: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  cardId?: string,
) {
  if (userId) {
    qc.invalidateQueries({ queryKey: cardKeys.list(userId) });
    qc.invalidateQueries({ queryKey: ['dashboard', userId] });
  }
  if (cardId) {
    qc.invalidateQueries({ queryKey: cardKeys.detail(cardId) });
    qc.invalidateQueries({ queryKey: cardKeys.benefits(cardId) });
    qc.invalidateQueries({ queryKey: cardKeys.milestones(cardId) });
  }
}

/**
 * Patch only cardholder_name — plaintext metadata, no encrypt/biometric.
 * Optimistic list+detail update; no Vault/Track/Home invalidate cascade.
 */
export function useUpdateCardholderName(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      cardholderName,
    }: {
      cardId: string;
      cardholderName: string;
    }): Promise<VaultCard> => {
      const holder = cardholderName.trim().slice(0, 80) || null;
      const { data, error } = await supabase
        .from('cards')
        .update({ cardholder_name: holder })
        .eq('id', cardId)
        .select(CARD_SELECT)
        .single();
      if (error) {
        logger.warn('Failed to update cardholder name', error);
        throw error;
      }
      return mapCardRow(data as CardRow);
    },
    onMutate: async ({ cardId, cardholderName }) => {
      const holder = cardholderName.trim().slice(0, 80) || null;
      await qc.cancelQueries({ queryKey: cardKeys.detail(cardId) });
      if (userId) {
        await qc.cancelQueries({ queryKey: cardKeys.list(userId) });
      }
      const prevDetail = qc.getQueryData<VaultCard>(cardKeys.detail(cardId));
      const prevList = userId
        ? qc.getQueryData<VaultCard[]>(cardKeys.list(userId))
        : undefined;
      if (prevDetail) {
        qc.setQueryData<VaultCard>(cardKeys.detail(cardId), {
          ...prevDetail,
          cardholderName: holder,
        });
      }
      if (userId && prevList) {
        qc.setQueryData<VaultCard[]>(
          cardKeys.list(userId),
          prevList.map((c) =>
            c.id === cardId ? { ...c, cardholderName: holder } : c,
          ),
        );
      }
      return { prevDetail, prevList };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prevDetail) {
        qc.setQueryData(cardKeys.detail(vars.cardId), ctx.prevDetail);
      }
      if (userId && ctx?.prevList) {
        qc.setQueryData(cardKeys.list(userId), ctx.prevList);
      }
    },
    onSuccess: (card) => {
      qc.setQueryData(cardKeys.detail(card.id), card);
      if (userId) {
        qc.setQueryData<VaultCard[]>(cardKeys.list(userId), (prev) =>
          prev
            ? prev.map((c) => (c.id === card.id ? card : c))
            : [card],
        );
      }
    },
  });
}

export function useCreateCard(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CardFormInput): Promise<VaultCard> => {
      if (!userId) throw new Error('Not signed in.');
      if (!input.nickname.trim() || !input.bankName.trim()) {
        throw new Error('Nickname and bank name are required.');
      }
      const secrets = await encryptCardSecrets(input);
      const { data, error } = await supabase
        .from('cards')
        .insert({
          user_id: userId,
          ...metaPayload(input),
          ...secrets,
        })
        .select(CARD_SELECT)
        .single();
      if (error) {
        logger.warn('Failed to create card', error);
        throw error;
      }
      const card = mapCardRow(data as CardRow);

      const drafts = input.draftBenefits?.filter((b) => b.title.trim()) ?? [];
      if (drafts.length > 0) {
        const { error: benefitError } = await supabase.from('card_benefits').insert(
          drafts.map((b) => ({
            card_id: card.id,
            title: b.title.trim(),
            category: b.category,
            description: b.description.trim(),
            value_estimate: b.valueEstimate,
          })),
        );
        if (benefitError) {
          logger.warn('Card created but benefits insert failed', benefitError);
        }
      }

      return card;
    },
    onSuccess: (card) => {
      // Seed local cache immediately so Vault works offline right after add.
      if (userId) {
        qc.setQueryData<VaultCard[]>(cardKeys.list(userId), (prev) =>
          prev ? [card, ...prev.filter((c) => c.id !== card.id)] : [card],
        );
      }
      qc.setQueryData(cardKeys.detail(card.id), card);
      invalidateCardQueries(qc, userId, card.id);
    },
  });
}

export function useUpdateCard(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      input,
      existing,
    }: {
      cardId: string;
      input: CardFormInput;
      existing: VaultCard;
    }): Promise<VaultCard> => {
      if (!input.nickname.trim() || !input.bankName.trim()) {
        throw new Error('Nickname and bank name are required.');
      }

      const panDigits = digitsOnly(input.cardNumber);
      const patch: Record<string, unknown> = { ...metaPayload(input) };

      if (panDigits.length > 0) {
        if (!isValidLuhn(panDigits)) {
          throw new Error('Enter a valid card number.');
        }
        const panEnc = await encryptField(panDigits);
        patch.last_four = lastFourFromNumber(panDigits);
        patch.card_number_encrypted = panEnc.ciphertext;
        patch.card_number_iv = panEnc.iv;
        patch.card_number_auth_tag = panEnc.authTag;
        // Re-encrypt clears txn-link block so confirms can attach again.
        patch.needs_refresh = false;
      }

      if (!input.storeCvv) {
        patch.cvv_encrypted = null;
        patch.cvv_iv = null;
        patch.cvv_auth_tag = null;
      } else if (digitsOnly(input.cvv).length > 0) {
        if (!isValidCvv(input.cvv, input.network)) {
          throw new Error('Enter a valid CVV (3–4 digits).');
        }
        const cvvEnc = await encryptField(digitsOnly(input.cvv));
        patch.cvv_encrypted = cvvEnc.ciphertext;
        patch.cvv_iv = cvvEnc.iv;
        patch.cvv_auth_tag = cvvEnc.authTag;
      } else if (!hasStoredCvv(existing)) {
        throw new Error('Enter a CVV or turn off Store CVV.');
      }

      const { data, error } = await supabase
        .from('cards')
        .update(patch)
        .eq('id', cardId)
        .select(CARD_SELECT)
        .single();
      if (error) {
        logger.warn('Failed to update card', error);
        throw error;
      }
      return mapCardRow(data as CardRow);
    },
    onSuccess: async (card, vars) => {
      if (userId) {
        qc.setQueryData<VaultCard[]>(cardKeys.list(userId), (prev) =>
          prev
            ? prev.map((c) => (c.id === card.id ? card : c))
            : [card],
        );
      }
      qc.setQueryData(cardKeys.detail(card.id), card);
      invalidateCardQueries(qc, userId, card.id);
      // Belt-and-suspenders if needs_refresh was set outside the PAN patch.
      if (vars.input.cardNumber && digitsOnly(vars.input.cardNumber).length > 0) {
        await clearCardTxnLinkBlocked(card.id);
      }
      if (userId) {
        qc.invalidateQueries({ queryKey: trackKeys.attention(userId) });
      }
    },
  });
}

export function useDeleteCard(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase.from('cards').delete().eq('id', cardId);
      if (error) {
        logger.warn('Failed to delete card', error);
        throw error;
      }
      return cardId;
    },
    onSuccess: (cardId) => {
      if (userId) {
        qc.setQueryData<VaultCard[]>(cardKeys.list(userId), (prev) =>
          prev ? prev.filter((c) => c.id !== cardId) : prev,
        );
      }
      invalidateCardQueries(qc, userId, cardId);
      qc.removeQueries({ queryKey: cardKeys.detail(cardId) });
    },
  });
}

export function useCreateBenefit(cardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BenefitFormInput): Promise<CardBenefit> => {
      if (!cardId) throw new Error('Missing card.');
      const { data, error } = await supabase
        .from('card_benefits')
        .insert({
          card_id: cardId,
          title: input.title.trim(),
          category: input.category,
          description: input.description.trim(),
          value_estimate: input.valueEstimate,
        })
        .select('*')
        .single();
      if (error) {
        logger.warn('Failed to create benefit', error);
        throw error;
      }
      return mapBenefitRow(data as BenefitRow);
    },
    onSuccess: () => {
      if (cardId) qc.invalidateQueries({ queryKey: cardKeys.benefits(cardId) });
    },
  });
}

export function useUpdateBenefit(cardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: BenefitFormInput;
    }): Promise<CardBenefit> => {
      const { data, error } = await supabase
        .from('card_benefits')
        .update({
          title: input.title.trim(),
          category: input.category,
          description: input.description.trim(),
          value_estimate: input.valueEstimate,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        logger.warn('Failed to update benefit', error);
        throw error;
      }
      return mapBenefitRow(data as BenefitRow);
    },
    onSuccess: () => {
      if (cardId) qc.invalidateQueries({ queryKey: cardKeys.benefits(cardId) });
    },
  });
}

export function useDeleteBenefit(cardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('card_benefits').delete().eq('id', id);
      if (error) {
        logger.warn('Failed to delete benefit', error);
        throw error;
      }
      return id;
    },
    onSuccess: () => {
      if (cardId) qc.invalidateQueries({ queryKey: cardKeys.benefits(cardId) });
    },
  });
}

export function useCreateMilestone(cardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MilestoneFormInput): Promise<CardMilestone> => {
      if (!cardId) throw new Error('Missing card.');
      const { data, error } = await supabase
        .from('card_milestones')
        .insert({
          card_id: cardId,
          target_spend: input.targetSpend,
          current_spend: input.currentSpend,
          reward_description: input.rewardDescription.trim(),
          period_start: input.periodStart,
          period_end: input.periodEnd,
        })
        .select('*')
        .single();
      if (error) {
        logger.warn('Failed to create milestone', error);
        throw error;
      }
      return mapMilestoneRow(data as MilestoneRow);
    },
    onSuccess: () => {
      if (cardId) qc.invalidateQueries({ queryKey: cardKeys.milestones(cardId) });
    },
  });
}

export function useUpdateMilestone(cardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: MilestoneFormInput;
    }): Promise<CardMilestone> => {
      const { data, error } = await supabase
        .from('card_milestones')
        .update({
          target_spend: input.targetSpend,
          current_spend: input.currentSpend,
          reward_description: input.rewardDescription.trim(),
          period_start: input.periodStart,
          period_end: input.periodEnd,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        logger.warn('Failed to update milestone', error);
        throw error;
      }
      return mapMilestoneRow(data as MilestoneRow);
    },
    onSuccess: () => {
      if (cardId) qc.invalidateQueries({ queryKey: cardKeys.milestones(cardId) });
    },
  });
}

export function useDeleteMilestone(cardId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('card_milestones').delete().eq('id', id);
      if (error) {
        logger.warn('Failed to delete milestone', error);
        throw error;
      }
      return id;
    },
    onSuccess: () => {
      if (cardId) qc.invalidateQueries({ queryKey: cardKeys.milestones(cardId) });
    },
  });
}

export function useMilestoneCycles(milestoneId: string | undefined) {
  return useQuery({
    queryKey: cardKeys.milestoneCycles(milestoneId ?? ''),
    enabled: Boolean(milestoneId),
    queryFn: async (): Promise<MilestoneCycle[]> => {
      const { data, error } = await supabase
        .from('milestone_cycles')
        .select('*')
        .eq('milestone_id', milestoneId!)
        .order('closed_at', { ascending: false });
      if (error) {
        logger.warn('Failed to load milestone cycles', error);
        throw error;
      }
      return ((data as MilestoneCycleRow[]) ?? []).map(mapMilestoneCycleRow);
    },
  });
}
