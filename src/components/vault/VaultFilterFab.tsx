/**
 * VaultFilterFab — floating filter button above the tab bar. Shows a count
 * badge when any non-default filter/sort is active.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui/AppText';
import { shadow, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function VaultFilterFab({
  bottom,
  activeCount,
  onPress,
}: {
  bottom: number;
  activeCount: number;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.fab,
        {
          bottom,
          backgroundColor: palette.navy800,
          borderColor: palette.glassBorderStrong,
        },
        activeCount > 0 && styles.fabActive,
        activeCount > 0 && { backgroundColor: palette.indigo },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        activeCount > 0
          ? `Filters, ${activeCount} active`
          : 'Filter and sort cards'
      }
    >
      <Ionicons
        name="options-outline"
        size={22}
        color={activeCount > 0 ? palette.textOnAccent : palette.textPrimary}
      />
      {activeCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: palette.amber }]}>
          <AppText variant="caption" color={palette.textOnAccent}>
            {activeCount}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: spacing.xl,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    zIndex: 20,
  },
  fabActive: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
