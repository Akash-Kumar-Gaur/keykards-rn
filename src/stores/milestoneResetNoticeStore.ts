/**
 * One-time non-blocking notices after auto milestone reset on renewal.
 */

import { create } from 'zustand';

export type MilestoneResetNotice = {
  id: string;
  cardId: string;
  cardNickname: string;
  reason: 'auto_renewal' | 'manual_reset';
};

type State = {
  notice: MilestoneResetNotice | null;
  push: (n: Omit<MilestoneResetNotice, 'id'>) => void;
  dismiss: () => void;
};

export const useMilestoneResetNoticeStore = create<State>((set) => ({
  notice: null,
  push: (n) =>
    set({
      notice: {
        ...n,
        id: `${n.cardId}-${Date.now()}`,
      },
    }),
  dismiss: () => set({ notice: null }),
}));
