/**
 * VaultCardList — picks a density tier from the user's total card count and
 * renders the matching layout:
 *   1-3  → Spotlight (hero cards, ambient themed glow, gloss sweep)
 *   4-7  → Compact   (reduced-height cards, restrained edge glow)
 *   8+   → Dense     (glass rows, accent strip, sync dot)
 *
 * Crossing a threshold reflows via Reanimated's layout transition instead of
 * snapping, so the 4th / 8th card visibly resizes the list.
 */

import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { VaultSpotlightCard } from '@/components/vault/VaultSpotlightCard';
import { VaultCompactCard } from '@/components/vault/VaultCompactCard';
import { VaultDenseRow } from '@/components/vault/VaultDenseRow';
import {
  vaultCardHeight,
  vaultDensityForCount,
  vaultItemGap,
  vaultStagger,
  type VaultDensity,
} from '@/lib/vaultDensity';
import { spacing } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VaultCard } from '@/types/card';

const REFLOW_MS = 420;

/** Above this many rows the per-row backdrop blur costs more than it adds. */
const MAX_BLURRED_ROWS = 14;

export function VaultCardList({
  cards,
  totalCount,
  onSelect,
}: {
  /** Cards to render (already filtered + sorted). */
  cards: VaultCard[];
  /** Total cards owned — drives the tier so filtering never changes density. */
  totalCount: number;
  onSelect: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  const density: VaultDensity = vaultDensityForCount(totalCount);
  const listWidth = width - spacing.xl * 2;
  const itemHeight = vaultCardHeight(density, listWidth);
  const gap = vaultItemGap(density);

  const layout = reduced ? undefined : LinearTransition.duration(REFLOW_MS);
  const blurRows = cards.length <= MAX_BLURRED_ROWS;

  return (
    <Animated.View style={[styles.list, { gap }]} layout={layout}>
      {cards.map((card, i) => (
        <Animated.View
          key={card.id}
          layout={layout}
          // Explicit height so a tier change animates as a resize, not a jump.
          style={[styles.item, { height: itemHeight }]}
        >
          <AnimatedEntrance
            delay={vaultStagger(density, i)}
            offsetY={density === 'spotlight' ? 28 : density === 'compact' ? 18 : 10}
          >
            {density === 'spotlight' ? (
              <VaultSpotlightCard
                card={card}
                onPress={() => onSelect(card.id)}
                shineDelay={vaultStagger(density, i) + 620}
              />
            ) : density === 'compact' ? (
              <VaultCompactCard
                card={card}
                height={itemHeight}
                onPress={() => onSelect(card.id)}
              />
            ) : (
              <VaultDenseRow
                card={card}
                height={itemHeight}
                blur={blurRows}
                onPress={() => onSelect(card.id)}
              />
            )}
          </AnimatedEntrance>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
  item: {
    width: '100%',
  },
});
