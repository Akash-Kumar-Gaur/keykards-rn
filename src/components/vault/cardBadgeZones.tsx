/**
 * CARD PREVIEW BADGE ZONES — layout convention for indicators on card previews
 * (CardFace, VaultListCard, Home carousel).
 *
 * Why this exists: absolute-positioned indicators used to collide (e.g. network
 * mark vs a status chip). Zones give every indicator a named, in-flow home.
 *
 * Vault list row (`list` layout):
 *   ┌──────────────────────────────────────────────┐
 *   │ ZONE_TOP_LEFT              TRAILING_VALUE    │
 *   │  bank name                  •••• 1234        │
 *   │  nickname                  NETWORK (text)    │
 *   │  ZONE_STATUS  ← reserved sync/status slot    │
 *   └──────────────────────────────────────────────┘
 *
 * CardFace (`spotlight` layout):
 *   ┌──────────────────────────────────────────────┐
 *   │ ZONE_TOP_LEFT            ZONE_TOP_RIGHT      │
 *   │  bank / nickname          Share (detail) /   │
 *   │  ZONE_STATUS              network (dense)    │
 *   │  …                                           │
 *   │ ZONE_BOTTOM_LEFT        ZONE_BOTTOM_RIGHT    │
 *   │  expiry / last four      network mark        │
 *   └──────────────────────────────────────────────┘
 *
 * RULES:
 *  1. Never use `position: 'absolute'` to place an indicator on a card preview.
 *  2. Status indicators go through `statusSlot` / ZONE_STATUS (under nickname
 *     on Vault list rows — never overlapping the trailing network column).
 *  3. Trailing column is reserved for last-four + network on list rows;
 *     ZONE_BOTTOM_RIGHT is reserved for the network mark on CardFace.
 *  4. Transaction-link / key-reentry state is NOT shown on Vault browsing —
 *     it belongs in Track “Needs attention” / confirm flows and Edit card.
 *     ZONE_STATUS is still reserved so a future indicator can’t collide.
 */

export {};
