/**
 * PlaceholderScreen — shared empty-state shell for tabs not built in Phase 1.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

interface PlaceholderScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  icon,
}: PlaceholderScreenProps) {
  const palette = usePalette();
  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: palette.indigoSoft }]}>
          <Ionicons name={icon} size={34} color={palette.indigo} />
        </View>
        <Eyebrow color={palette.indigo}>{eyebrow}</Eyebrow>
        <AppText variant="h2" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="body" color={palette.textSecondary} style={styles.description}>
          {description}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center' },
  description: { textAlign: 'center', lineHeight: 22 },
});
