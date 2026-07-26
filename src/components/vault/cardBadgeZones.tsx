/**
 * CARD PREVIEW BADGE ZONES — the single layout convention for every indicator
 * drawn on or around a card preview (CardFace, Vault tiers, Home stack).
 *
 * Why this exists: absolute-positioned indicators used to collide (e.g. network
 * mark vs a status chip). Zones give every indicator a named, in-flow home.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ ZONE_TOP_LEFT            ZONE_TOP_RIGHT      │
 *   │  bank name                network mark       │
 *   │  nickname                 (dense variants)   │
 *   │  ZONE_STATUS  ← optional status indicators   │
 *   │                                              │
 *   │  chip / contactless / masked number          │
 *   │                                              │
 *   │ ZONE_BOTTOM_LEFT        ZONE_BOTTOM_RIGHT    │
 *   │  expiry / last four      hint + network mark │
 *   └──────────────────────────────────────────────┘
 *
 * RULES — follow these when adding a new indicator:
 *  1. Never use `position: 'absolute'` to place an indicator on a card preview.
 *  2. Status indicators go through `CardFace`'s `statusSlot` (ZONE_STATUS).
 *  3. ZONE_TOP_RIGHT / ZONE_BOTTOM_RIGHT are reserved for the network mark.
 *  4. Transaction-link / key-reentry state is NOT shown on Vault browsing —
 *     it belongs in Track “Needs attention” / confirm flows and Edit card.
 */

export {};
