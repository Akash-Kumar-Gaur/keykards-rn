/**
 * Soft, dismissible prompt for accounts that never set a real display name.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Props = {
  onAddName: () => void;
  onDismiss: () => void;
};

export function NameNudgeBanner({ onAddName, onDismiss }: Props) {
  const palette = usePalette();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette.indigoSoft,
          borderColor: palette.glassBorder,
        },
      ]}
    >
      <Ionicons name="person-circle-outline" size={20} color={palette.indigo} />
      <Pressable
        onPress={onAddName}
        style={styles.textPress}
        accessibilityRole="button"
        accessibilityLabel="Add your name"
      >
        <AppText variant="small" style={styles.text}>
          Add your name so Home can greet you properly
        </AppText>
      </Pressable>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color={palette.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  textPress: { flex: 1, flexShrink: 1 },
  text: { flexShrink: 1 },
});
