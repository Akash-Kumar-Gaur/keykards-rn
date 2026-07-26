/**
 * Non-blocking banner after auto milestone reset on renewal.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { useMilestoneResetNoticeStore } from '@/stores/milestoneResetNoticeStore';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function MilestoneResetNoticeBanner() {
  const palette = usePalette();
  const notice = useMilestoneResetNoticeStore((s) => s.notice);
  const dismiss = useMilestoneResetNoticeStore((s) => s.dismiss);

  if (!notice) return null;

  const copy =
    notice.reason === 'auto_renewal'
      ? `Your ${notice.cardNickname} milestone reset for the new cycle`
      : `${notice.cardNickname} milestone was reset`;

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
      <Ionicons name="refresh-circle" size={20} color={palette.indigo} />
      <AppText variant="small" style={styles.text}>
        {copy}
      </AppText>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss">
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
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: { flex: 1, flexShrink: 1 },
});
