/**
 * Track tab card scope — "All cards" (null) or a single vault card id.
 */

import { create } from 'zustand';

type State = {
  /** null = aggregate All cards view */
  selectedCardId: string | null;
  setSelectedCardId: (id: string | null) => void;
};

export const useTrackScopeStore = create<State>((set) => ({
  selectedCardId: null,
  setSelectedCardId: (id) => set({ selectedCardId: id }),
}));
