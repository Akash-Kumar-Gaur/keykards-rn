/**
 * IconBadge — small circular icon badge with a tinted background.
 * Optional `accentColor` overrides the indigo tone (Track card theming).
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '@/providers/AppThemeProvider';
import { hexToSoft } from '@/lib/trackAccent';

export type BadgeTone = 'amber' | 'green' | 'indigo';

interface IconBadgeProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: BadgeTone;
  size?: number;
  /** When set with tone="indigo", replaces the default indigo accent. */
  accentColor?: string;
}

export function IconBadge({
  icon,
  tone = 'indigo',
  size = 36,
  accentColor,
}: IconBadgeProps) {
  const palette = usePalette();
  const tones = useMemo(
    () => ({
      amber: { bg: palette.amberSoft, fg: palette.amber },
      green: { bg: palette.greenSoft, fg: palette.green },
      indigo: { bg: palette.indigoSoft, fg: palette.indigo },
    }),
    [palette],
  );
  const base = tones[tone];
  const fg = tone === 'indigo' && accentColor ? accentColor : base.fg;
  const bg =
    tone === 'indigo' && accentColor ? hexToSoft(accentColor) : base.bg;
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
