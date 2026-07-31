/**
 * Cross-screen card morph — the shared-element style hand-off from the camera
 * scan reveal into the add-card form's preview.
 *
 * Expo Router vendors its own native-stack fork with no `sharedTransitionTag`
 * wiring, and Reanimated's own shared transitions are experimental and gated
 * behind a native feature flag. So this is done by hand: the source publishes
 * the card plus the rect it currently occupies, the destination reports where
 * its preview actually landed, and a root-level overlay animates between them.
 *
 * In-memory only, like the capture store — never persisted, never logged.
 */

import { create } from 'zustand';
import type { CardNetwork } from '@/types/card';

export type MorphRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Just enough to render a CardFace identical to the destination's preview. */
export type MorphCard = {
  lastFour: string;
  network: CardNetwork;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardholderName: string | null;
};

/**
 * idle    — nothing in flight
 * pending — overlay is holding at `from`, waiting for the destination to measure
 * running — animating `from` → `to`
 * landing — arrived; overlay and the real preview cross-fade
 */
export type MorphPhase = 'idle' | 'pending' | 'running' | 'landing';

interface CardMorphState {
  card: MorphCard | null;
  from: MorphRect | null;
  to: MorphRect | null;
  phase: MorphPhase;
  /** Source hands off: show this card at this rect and await a target. */
  start: (card: MorphCard, from: MorphRect) => void;
  /** Destination reports where its preview landed. */
  setTarget: (to: MorphRect) => void;
  /** Overlay reached the target — begin the cross-fade. */
  land: () => void;
  /** Cross-fade finished, or the hand-off was abandoned. */
  finish: () => void;
}

const EMPTY = {
  card: null,
  from: null,
  to: null,
  phase: 'idle',
} as const;

export const useCardMorphStore = create<CardMorphState>((set, get) => ({
  ...EMPTY,
  start: (card, from) => set({ card, from, to: null, phase: 'pending' }),
  setTarget: (to) => {
    // Ignore a late or duplicate measurement once the morph is under way.
    if (get().phase !== 'pending') return;
    set({ to, phase: 'running' });
  },
  land: () => {
    if (get().phase !== 'running') return;
    set({ phase: 'landing' });
  },
  finish: () => set({ ...EMPTY }),
}));
