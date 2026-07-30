/**
 * VaultCardList — swipe-to-delete + long-press multi-select wrappers around
 * compact full-width rows.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { VaultListCard } from '@/components/vault/VaultListCard';
import { VaultSwipeableRow } from '@/components/vault/VaultSwipeableRow';
import { VAULT_ROW_GAP } from '@/lib/vaultDensity';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VaultCard } from '@/types/card';

const REFLOW_MS = 420;

export function VaultCardList({
  cards,
  onSelect,
  onLongPressSelect,
  onRequestDelete,
  openRowId,
  onOpenRowChange,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: {
  cards: VaultCard[];
  onSelect: (id: string) => void;
  onLongPressSelect: (id: string) => void;
  onRequestDelete: (id: string) => void;
  openRowId: string | null;
  onOpenRowChange: (id: string | null) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const layout = reduced ? undefined : LinearTransition.duration(REFLOW_MS);
  const exiting = reduced ? undefined : FadeOut.duration(180);

  return (
    <Animated.View style={[styles.list, { gap: VAULT_ROW_GAP }]} layout={layout}>
      {cards.map((card, i) => (
        <Animated.View key={card.id} layout={layout} exiting={exiting} style={styles.item}>
          <VaultSwipeableRow
            rowId={card.id}
            openRowId={selectionMode ? null : openRowId}
            onOpenChange={onOpenRowChange}
            onActionPress={() => onRequestDelete(card.id)}
            disabled={selectionMode}
          >
            <VaultListCard
              card={card}
              index={i}
              selectionMode={selectionMode}
              selected={selectedIds.has(card.id)}
              onPress={() => {
                if (selectionMode) onToggleSelect(card.id);
                else {
                  if (openRowId) onOpenRowChange(null);
                  else onSelect(card.id);
                }
              }}
              onLongPress={() => {
                if (!selectionMode) onLongPressSelect(card.id);
              }}
            />
          </VaultSwipeableRow>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%' },
  item: { width: '100%' },
});
