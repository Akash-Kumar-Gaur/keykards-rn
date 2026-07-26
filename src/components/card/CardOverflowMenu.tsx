/**
 * CardOverflowMenu — the (⋯) header action. Opens a bottom sheet with
 * Edit / Manage / Delete list options. Delete still routes through the caller's
 * confirmation dialog (this only surfaces the intent).
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export interface OverflowAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}

export function CardOverflowMenu({
  visible,
  onClose,
  actions,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  actions: OverflowAction[];
  onSelect: (id: string) => void;
}) {
  const palette = usePalette();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="title" style={styles.heading}>
        Card options
      </AppText>
      <View style={styles.list}>
        {actions.map((a) => (
          <Pressable
            key={a.id}
            style={styles.row}
            onPress={() => {
              onClose();
              // Let the sheet begin closing before the action fires.
              setTimeout(() => onSelect(a.id), 0);
            }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: palette.indigoSoft },
                a.destructive && { backgroundColor: palette.amberSoft },
              ]}
            >
              <Ionicons
                name={a.icon}
                size={20}
                color={a.destructive ? palette.amber : palette.indigo}
              />
            </View>
            <AppText
              variant="body"
              color={a.destructive ? palette.amber : palette.textPrimary}
            >
              {a.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

/** The (⋯) trigger button for the header. */
export function OverflowButton({ onPress }: { onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={styles.trigger}
      accessibilityRole="button"
      accessibilityLabel="More options"
    >
      <Ionicons name="ellipsis-horizontal" size={22} color={palette.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.xs },
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trigger: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
