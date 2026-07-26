/**
 * Tag — small pill-shaped label chip with a tinted fill.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Eyebrow } from './AppText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function Tag({
  label,
  tint,
  color,
}: {
  label: string;
  tint?: string;
  color?: string;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.pill, { backgroundColor: tint ?? palette.indigoSoft }]}>
      <Eyebrow color={color ?? palette.indigo}>{label}</Eyebrow>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
});
