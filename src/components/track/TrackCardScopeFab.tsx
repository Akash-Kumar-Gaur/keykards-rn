/**
 * TrackCardScopeFab — floating pill showing current Track scope.
 * Bottom-right, above the tab bar (same band as Vault FABs).
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { useTrackAccentBgStyle } from '@/components/track/TrackTheme';
import { radius, shadow, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Props = {
  bottom: number;
  label: string;
  swatchColor: string | null;
  onPress: () => void;
};

export function TrackCardScopeFab({ bottom, label, swatchColor, onPress }: Props) {
  const palette = usePalette();
  const accentBg = useTrackAccentBgStyle();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.wrap, { bottom }]}
      accessibilityRole="button"
      accessibilityLabel={`Card filter: ${label}`}
    >
      <Animated.View style={[styles.fab, accentBg]}>
        {swatchColor ? (
          <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
        ) : (
          <Ionicons name="layers-outline" size={18} color={palette.textOnAccent} />
        )}
        <AppText
          variant="small"
          color={palette.textOnAccent}
          numberOfLines={1}
          style={styles.label}
        >
          {label}
        </AppText>
        <Ionicons name="chevron-up" size={16} color={palette.textOnAccent} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.xl,
    zIndex: 20,
    maxWidth: '72%',
    ...shadow.accent,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    minHeight: 48,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  label: { flexShrink: 1 },
});
