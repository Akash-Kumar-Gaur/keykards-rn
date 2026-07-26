/**
 * Duplicate-card detection for the Add/Edit Card flows.
 *
 * SECURITY: matches on non-sensitive metadata only — last_four + expiry
 * (and bank_name when the form has one). Full PANs are never compared.
 *
 * Ready to check as soon as last four + expiry exist — do not wait for
 * nickname, CVV, fee, or benefits. Bank is optional for the early trigger
 * (catalog/NFC often lack it); when present it tightens the match.
 */

import { digitsOnly, lastFourFromNumber } from '@/lib/cardUtils';
import type { VaultCard } from '@/types/card';

export type DuplicateSignature = {
  bankName: string;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
};

/** Bank names vary in case/punctuation/spacing between catalog and manual entry. */
function normalizeBank(bankName: string): string {
  return bankName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Session key for "already warned / add anyway" — last four + expiry only,
 * so an early ack (before bank is filled) still suppresses later prompts for
 * the same card identity.
 */
export function acknowledgeKey(sig: DuplicateSignature): string {
  return [
    digitsOnly(sig.lastFour).slice(-4),
    sig.expiryMonth,
    sig.expiryYear,
  ].join('|');
}

/** @deprecated Prefer acknowledgeKey for session memory; kept for tests. */
export function duplicateKey(sig: DuplicateSignature): string {
  return [
    normalizeBank(sig.bankName) || '*',
    acknowledgeKey(sig),
  ].join('|');
}

/**
 * Ready once last four + expiry are present. Bank is NOT required — that lets
 * the warning fire during manual number entry and right after NFC/scan.
 */
export function isReadyForDuplicateCheck(sig: DuplicateSignature): boolean {
  return (
    digitsOnly(sig.lastFour).length === 4 &&
    sig.expiryMonth >= 1 &&
    sig.expiryMonth <= 12 &&
    sig.expiryYear > 0
  );
}

/** @deprecated Use isReadyForDuplicateCheck. */
export function isCompleteSignature(sig: DuplicateSignature): boolean {
  return isReadyForDuplicateCheck(sig);
}

/**
 * Signature for a pending save / live check.
 *
 * `fallbackLastFour` covers Edit, where a blank card number means "keep the
 * existing ciphertext" — the card's stored last four still applies.
 */
export function signatureFromForm(args: {
  bankName?: string | null;
  cardNumber?: string | null;
  lastFour?: string | null;
  expiryMonth: number;
  expiryYear: number;
  fallbackLastFour?: string | null;
}): DuplicateSignature {
  const typed = digitsOnly(args.cardNumber ?? '');
  const explicit = digitsOnly(args.lastFour ?? '').slice(-4);
  const lastFour =
    typed.length >= 4
      ? lastFourFromNumber(typed)
      : explicit.length === 4
        ? explicit
        : digitsOnly(args.fallbackLastFour ?? '').slice(-4);
  return {
    bankName: args.bankName?.trim() ?? '',
    lastFour,
    expiryMonth: args.expiryMonth,
    expiryYear: args.expiryYear,
  };
}

export function signatureFromCard(card: VaultCard): DuplicateSignature {
  return {
    bankName: card.bankName,
    lastFour: card.lastFour,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
  };
}

/**
 * First existing card matching this signature, or null.
 *
 * Match rules:
 *  - last_four + expiry must always match
 *  - if the candidate signature has a bank name, require bank match too
 *  - if bank is still empty (early entry / NFC), last4+expiry alone is enough
 *
 * `excludeCardId` keeps Edit from matching a card against itself.
 */
export function findDuplicateCard(args: {
  cards: VaultCard[];
  signature: DuplicateSignature;
  excludeCardId?: string | null;
}): VaultCard | null {
  const { cards, signature, excludeCardId } = args;
  if (!isReadyForDuplicateCheck(signature)) return null;

  const lastFour = digitsOnly(signature.lastFour).slice(-4);
  const bank = normalizeBank(signature.bankName);

  return (
    cards.find((c) => {
      if (excludeCardId && c.id === excludeCardId) return false;
      if (digitsOnly(c.lastFour).slice(-4) !== lastFour) return false;
      if (c.expiryMonth !== signature.expiryMonth) return false;
      if (c.expiryYear !== signature.expiryYear) return false;
      if (bank && normalizeBank(c.bankName) !== bank) return false;
      return true;
    }) ?? null
  );
}

/** "Add anyway" — skip further prompts for this last4+expiry this session. */
const acknowledged = new Set<string>();
/**
 * Keys we've already shown a dialog for (Cancel or Add anyway). Lets the live
 * field check stay quiet while the user edits; save-time checks ignore it.
 */
const prompted = new Set<string>();

export function isDuplicateAcknowledged(sig: DuplicateSignature): boolean {
  return acknowledged.has(acknowledgeKey(sig));
}

export function acknowledgeDuplicate(sig: DuplicateSignature): void {
  const key = acknowledgeKey(sig);
  acknowledged.add(key);
  prompted.add(key);
}

export function markDuplicatePrompted(sig: DuplicateSignature): void {
  prompted.add(acknowledgeKey(sig));
}

export function wasDuplicatePrompted(sig: DuplicateSignature): boolean {
  return prompted.has(acknowledgeKey(sig));
}

/** Test seam. */
export function resetDuplicateAcknowledgements(): void {
  acknowledged.clear();
  prompted.clear();
}

export function duplicateWarningMessage(match: VaultCard): string {
  return `You already have a card matching these details — ${match.nickname}. Add it anyway?`;
}
