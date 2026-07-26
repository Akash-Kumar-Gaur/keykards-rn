/**
 * QuickChips — glance pills below the hero card.
 * Chips with `target` are jump actions (chevron). Chips without are read-only
 * labels — softer chrome so they don’t read as dead tabs.
 */

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export type ChipTone = 'neutral' | 'amber' | 'green' | 'indigo';

export interface QuickChip {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: ChipTone;
  /** Section key to scroll to on press. Omit for glance-only. */
  target?: string;
}


export function QuickChips({
  chips,
  onJump,
}: {
  chips: QuickChip[];
  onJump?: (target: string) => void;
}) {
  const palette = usePalette();
  const toneMap = useMemo(
    (): Record<ChipTone, { bg: string; border: string; fg: string }> => ({
      neutral: { bg: palette.glassFill, border: palette.glassBorder, fg: palette.textSecondary },
      indigo: {
        bg: palette.indigoSoft,
        border: palette.glassBorderStrong,
        fg: palette.indigo,
      },
      amber: {
        bg: palette.amberSoft,
        border: palette.glassBorderStrong,
        fg: palette.amber,
      },
      green: {
        bg: palette.greenSoft,
        border: palette.glassBorderStrong,
        fg: palette.green,
      },
    }),
    [palette],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => {
        const tone = toneMap[chip.tone ?? 'neutral'];
        const pressable = Boolean(chip.target && onJump);
        const content = (
          <>
            <Ionicons name={chip.icon} size={14} color={tone.fg} />
            <AppText variant="small" color={tone.fg}>
              {chip.label}
            </AppText>
            {pressable ? (
              <Ionicons name="chevron-forward" size={12} color={tone.fg} />
            ) : null}
          </>
        );

        if (!pressable) {
          return (
            <View
              key={chip.id}
              style={[
                styles.chip,
                styles.chipGlance,
                { borderColor: tone.border },
              ]}
              accessibilityRole="text"
              accessibilityLabel={chip.label}
            >
              {content}
            </View>
          );
        }

        return (
          <Pressable
            key={chip.id}
            onPress={() => {
              Haptics.selectionAsync();
              onJump!(chip.target!);
            }}
            style={[
              styles.chip,
              styles.chipAction,
              { backgroundColor: tone.bg, borderColor: tone.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
          >
            {content}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  /** Read-only — no fill, quieter so it doesn’t look like a dead tab. */
  chipGlance: {
    backgroundColor: 'transparent',
  },
  chipAction: {},
});
