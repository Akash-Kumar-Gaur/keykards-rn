/**
 * VaultAddCardFab — bottom-right floating "Add card" CTA with label.
 * Thumb-friendly alternative to a header + button.
 */

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '@/components/ui/AppText';
import { radius, shadow, spacing } from '@/theme';
import { useGradients, usePalette } from '@/providers/AppThemeProvider';

export function VaultAddCardFab({
  bottom,
  onPress,
}: {
  bottom: number;
  onPress: () => void;
}) {
  const palette = usePalette();
  const gradients = useGradients();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.wrap, { bottom }]}
      accessibilityRole="button"
      accessibilityLabel="Add card"
    >
      <LinearGradient
        colors={[...gradients.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fab}
      >
        <Ionicons name="add" size={22} color={palette.textOnAccent} />
        <AppText variant="body" color={palette.textOnAccent}>
          Add card
        </AppText>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.xl,
    zIndex: 20,
    ...shadow.accent,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    minHeight: 52,
  },
});
