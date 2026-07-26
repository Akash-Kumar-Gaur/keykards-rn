/**
 * Dashboard domain types.
 *
 * Authenticated Home is driven only by these shapes — never by fabricated
 * demo numbers. `null` on a section means "empty / no data yet".
 */

export interface SmartSwipeRecommendation {
  category: string;
  cardName: string;
  rewardValue: string;
  rewardLabel: string;
}

export interface StatTileData {
  label: string;
  value: string;
  subLabel: string;
}

export interface MilestoneData {
  title: string;
  current: string;
  target: string;
  progress: number; // 0..1
  helperText: string;
}

export interface CardSummary {
  id: string;
  displayName: string | null;
  createdAt: string;
}

export interface DashboardData {
  cards: CardSummary[];
  cardCount: number;
  /**
   * Confirmed transactions in the last 30 days — feeds Smart Swipe eligibility.
   * Not a display tile; used only for Home layout branching.
   */
  recentConfirmedTxnCount: number;
  /** null until Optimize (Phase 4) has a real recommendation. */
  smartSwipe: SmartSwipeRecommendation | null;
  expiring: StatTileData | null;
  annualFees: StatTileData | null;
  milestone: MilestoneData | null;
  warranties: StatTileData | null;
  subscriptions: StatTileData | null;
}

export function emptyDashboard(): DashboardData {
  return {
    cards: [],
    cardCount: 0,
    recentConfirmedTxnCount: 0,
    smartSwipe: null,
    expiring: null,
    annualFees: null,
    milestone: null,
    warranties: null,
    subscriptions: null,
  };
}
