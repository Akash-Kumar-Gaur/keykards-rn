/**
 * ConfidenceBadge — Confirmed vs Estimated for dates/sources that are
 * still shown as labeled estimates (renewal, points expiry).
 *
 * Do NOT invent a “Listed · est.” style for catalog ₹ figures — those numbers
 * should not appear in the UI at all (see AGENTS.md display principle).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export type ConfidenceKind = 'estimated' | 'confirmed';

const LABELS: Record<ConfidenceKind, string> = {
  estimated: 'Estimated',
  confirmed: 'Confirmed',
};

export function ConfidenceBadge({
  kind,
  label,
}: {
  kind: ConfidenceKind;
  /** Override default label text. */
  label?: string;
}) {
  const palette = usePalette();
  const isConfirmed = kind === 'confirmed';
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: isConfirmed ? palette.indigoSoft : palette.amberSoft,
        },
      ]}
      accessibilityLabel={label ?? LABELS[kind]}
    >
      <AppText
        variant="caption"
        color={isConfirmed ? palette.indigo : palette.amber}
        style={styles.text}
      >
        {label ?? LABELS[kind]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
