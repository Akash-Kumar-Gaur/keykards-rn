/**
 * Card-link resolution for confirms: never silently drop a transaction when
 * the target card can't be attached yet.
 */

import type { CardHint, TransactionLinkStatus } from '@/types/track';

export type { CardHint, TransactionLinkStatus };

export type LinkDecision = {
  cardId: string | null;
  linkStatus: TransactionLinkStatus;
  cardHint: CardHint | null;
};

function cleanHint(hint: CardHint | null | undefined): CardHint | null {
  if (!hint) return null;
  const last = hint.last_four?.trim() || null;
  const bank = hint.bank_name_guess?.trim() || null;
  if (!last && !bank) return null;
  return {
    ...(last ? { last_four: last } : {}),
    ...(bank ? { bank_name_guess: bank } : {}),
  };
}

/**
 * Decide how to persist a confirm against a card that may block linking.
 *
 * - Ready card selected → linked with card_id
 * - txnLinkBlocked card selected → pending_sync, card_id null, hint from that card
 * - No card, but parse hints exist → pending_sync with those hints
 * - No card and no hints → unmatched
 */
export function resolveLinkDecision(args: {
  selectedCardId: string | null;
  selectedCard?: {
    id: string;
    lastFour: string;
    bankName: string;
    /** When true, confirm must stay pending_sync until PAN re-entry. */
    txnLinkBlocked: boolean;
  } | null;
  parseLastFour?: string | null;
  parseBankHint?: string | null;
}): LinkDecision {
  const { selectedCardId, selectedCard, parseLastFour, parseBankHint } = args;
  const parseHint = cleanHint({
    last_four: parseLastFour,
    bank_name_guess: parseBankHint,
  });

  if (selectedCardId && selectedCard && selectedCard.id === selectedCardId) {
    if (selectedCard.txnLinkBlocked) {
      return {
        cardId: null,
        linkStatus: 'pending_sync',
        cardHint: cleanHint({
          last_four: selectedCard.lastFour || parseLastFour,
          bank_name_guess: selectedCard.bankName || parseBankHint,
        }),
      };
    }
    return {
      cardId: selectedCardId,
      linkStatus: 'linked',
      cardHint: parseHint,
    };
  }

  // Selected id without a loaded card row — treat as pending if we have hints.
  if (selectedCardId) {
    if (parseHint) {
      return { cardId: null, linkStatus: 'pending_sync', cardHint: parseHint };
    }
    // Orphan selection with no hint: keep the id as linked (best effort).
    return { cardId: selectedCardId, linkStatus: 'linked', cardHint: null };
  }

  if (parseHint) {
    return { cardId: null, linkStatus: 'pending_sync', cardHint: parseHint };
  }

  return { cardId: null, linkStatus: 'unmatched', cardHint: null };
}

/** True when a pending_sync hint looks like it belongs to this card. */
export function cardHintMatchesCard(
  hint: CardHint | null | undefined,
  card: { lastFour: string; bankName: string },
): boolean {
  if (!hint) return false;
  const last = hint.last_four?.trim();
  if (last && last === card.lastFour) return true;

  const guess = hint.bank_name_guess?.trim().toLowerCase();
  if (!guess) return false;
  const bank = card.bankName.trim().toLowerCase();
  if (!bank) return false;
  if (guess === bank) return true;
  const first = guess.split(/\s+/)[0];
  return Boolean(first) && bank.includes(first);
}
