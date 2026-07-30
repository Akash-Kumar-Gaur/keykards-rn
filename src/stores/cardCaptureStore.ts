/**
 * Ephemeral Add-Card capture store — holds PAN/expiry from NFC or camera OCR
 * in memory only until the form consumes it. Never persisted, never logged.
 */

import { create } from 'zustand';

export type CardCaptureSource = 'nfc' | 'scan';

export interface CardCapturePayload {
  /** Full or partial digits only. Empty when unknown. */
  panDigits: string;
  /** True when bank masked the PAN or we only got last 4 / truncated. */
  isPartial: boolean;
  expiryMonth: number | null;
  expiryYear: number | null;
  /** Visa / Mastercard / RuPay / … from AID when known. */
  networkHint: string | null;
  /**
   * Name printed on the card when OCR extracts it (optional).
   * NFC rarely provides this; camera OCR may.
   */
  cardholderName: string | null;
  source: CardCaptureSource;
  /** User-facing notice (e.g. bank masked PAN). */
  notice: string | null;
}

interface CardCaptureState {
  capture: CardCapturePayload | null;
  setCapture: (payload: CardCapturePayload) => void;
  /** Read once and clear — form should call this on mount. */
  takeCapture: () => CardCapturePayload | null;
  clear: () => void;
}

export const useCardCaptureStore = create<CardCaptureState>((set, get) => ({
  capture: null,
  setCapture: (payload) => set({ capture: payload }),
  takeCapture: () => {
    const current = get().capture;
    set({ capture: null });
    return current;
  },
  clear: () => set({ capture: null }),
}));
