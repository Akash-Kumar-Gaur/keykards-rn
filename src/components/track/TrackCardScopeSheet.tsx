/**
 * TrackCardScopeSheet — pick All cards or a single vault card.
 * Compact rows with color swatch + network badge (Vault-adjacent styling).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AppText } from '@/components/ui/AppText';
import { NetworkBadge } from '@/components/vault/NetworkBadge';
import { getCardTheme } from '@/lib/cardThemes';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { VaultCard } from '@/types/card';

type Props = {
  visible: boolean;
  onClose: () => void;
  cards: VaultCard[];
  selectedCardId: string | null;
  onSelect: (cardId: string | null) => void;
};

export function TrackCardScopeSheet({
  visible,
  onClose,
  cards,
  selectedCardId,
  onSelect,
}: Props) {
  const palette = usePalette();
  const pick = (id: string | null) => {
    Haptics.selectionAsync();
    onSelect(id);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="title" style={styles.heading}>
        View cards
      </AppText>
      <AppText variant="caption" color={palette.textTertiary} style={styles.sub}>
        Filter Spend & rewards to one card, or see everything together.
      </AppText>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <ScopeRow
          selected={selectedCardId == null}
          onPress={() => pick(null)}
            leading={
            <View style={[styles.swatch, styles.allSwatch, { backgroundColor: palette.indigoSoft }]}>
              <Ionicons name="layers-outline" size={14} color={palette.indigo} />
            </View>
          }
          title="All cards"
          subtitle={`${cards.length} in vault`}
        />

        {cards.map((c) => {
          const theme = getCardTheme(c.cardColorTheme);
          return (
            <ScopeRow
              key={c.id}
              selected={selectedCardId === c.id}
              onPress={() => pick(c.id)}
              leading={
                <View
                  style={[styles.swatch, { backgroundColor: theme.colors[0] }]}
                />
              }
              title={c.nickname}
              subtitle={`${c.bankName} · ···· ${c.lastFour}`}
              trailing={<NetworkBadge network={c.network} size="sm" />}
            />
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

function ScopeRow({
  selected,
  onPress,
  leading,
  title,
  subtitle,
  trailing,
}: {
  selected: boolean;
  onPress: () => void;
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: palette.glassFill,
          borderColor: palette.glassBorder,
        },
        selected && {
          borderColor: palette.indigo,
          backgroundColor: palette.indigoSoft,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      {leading}
      <View style={styles.rowText}>
        <AppText variant="body" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color={palette.textTertiary} numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      {trailing}
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={palette.indigo} />
      ) : (
        <View style={styles.checkSpacer} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.xs },
  sub: { marginBottom: spacing.lg },
  list: { maxHeight: 420 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  allSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSpacer: { width: 22 },
});
