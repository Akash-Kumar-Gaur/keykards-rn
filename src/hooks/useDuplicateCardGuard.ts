/**
 * Duplicate-card guard — early (as soon as last4+expiry) and at save.
 *
 * Never decrypts stored PANs. Uses the themed confirm dialog.
 */

import { useCallback } from 'react';
import { useCards } from '@/hooks/useCards';
import { confirmDialog } from '@/stores/dialogStore';
import {
  acknowledgeDuplicate,
  duplicateWarningMessage,
  findDuplicateCard,
  isDuplicateAcknowledged,
  isReadyForDuplicateCheck,
  markDuplicatePrompted,
  signatureFromForm,
  wasDuplicatePrompted,
  type DuplicateSignature,
} from '@/lib/duplicateCard';
import type { CardFormInput } from '@/types/card';

export type DuplicateCheckArgs = {
  bankName?: string | null;
  cardNumber?: string | null;
  lastFour?: string | null;
  expiryMonth: number;
  expiryYear: number;
  excludeCardId?: string | null;
  fallbackLastFour?: string | null;
  /**
   * When true (live field check), skip if we already prompted for this
   * last4+expiry this session — avoids re-opening after Cancel / NFC.
   * Save-time checks leave this false so Cancel still gets a final confirm
   * unless the user chose Add anyway.
   */
  skipIfAlreadyPrompted?: boolean;
};

export function useDuplicateCardGuard(userId: string | undefined) {
  const { data: cards = [] } = useCards(userId);

  const warnIfDuplicate = useCallback(
    async (args: DuplicateCheckArgs): Promise<boolean> => {
      const signature = signatureFromForm(args);
      if (!isReadyForDuplicateCheck(signature)) return true;

      if (isDuplicateAcknowledged(signature)) return true;
      if (args.skipIfAlreadyPrompted && wasDuplicatePrompted(signature)) {
        return true;
      }

      const match = findDuplicateCard({
        cards,
        signature,
        excludeCardId: args.excludeCardId ?? null,
      });
      if (!match) return true;

      markDuplicatePrompted(signature);

      const proceed = await confirmDialog({
        title: 'Possible duplicate card',
        message: duplicateWarningMessage(match),
        icon: 'copy-outline',
        tone: 'amber',
        confirmLabel: 'Add anyway',
        cancelLabel: 'Cancel',
      });

      if (proceed) acknowledgeDuplicate(signature);
      return proceed;
    },
    [cards],
  );

  /** Save-time helper — maps CardFormInput → warnIfDuplicate. */
  const confirmNotDuplicate = useCallback(
    async (
      input: CardFormInput,
      opts?: { excludeCardId?: string | null; fallbackLastFour?: string | null },
    ): Promise<boolean> => {
      return warnIfDuplicate({
        bankName: input.bankName,
        cardNumber: input.cardNumber,
        expiryMonth: input.expiryMonth,
        expiryYear: input.expiryYear,
        excludeCardId: opts?.excludeCardId ?? null,
        fallbackLastFour: opts?.fallbackLastFour ?? null,
      });
    },
    [warnIfDuplicate],
  );

  return { warnIfDuplicate, confirmNotDuplicate, cards };
}

/** Build a signature from a capture payload (NFC / future scan). */
export function signatureFromCapture(capture: {
  panDigits: string;
  expiryMonth: number | null;
  expiryYear: number | null;
}): DuplicateSignature | null {
  if (capture.expiryMonth == null || capture.expiryYear == null) return null;
  const sig = signatureFromForm({
    cardNumber: capture.panDigits,
    expiryMonth: capture.expiryMonth,
    expiryYear: capture.expiryYear,
  });
  return isReadyForDuplicateCheck(sig) ? sig : null;
}
