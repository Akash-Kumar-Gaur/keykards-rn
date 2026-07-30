/**
 * Gmail opt-in — Coming soon until a real OAuth token exchange ships.
 *
 * Integrity rule: never show "Connected" unless a verified OAuth refresh token
 * exists server-side. Until Google client IDs + Edge Function exchange are
 * wired, this screen is intentionally non-actionable.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function GmailConnectScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <GlowBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.huge,
          },
        ]}
      >
        <PillButton
          label="Back"
          variant="ghost"
          size="sm"
          icon="chevron-back"
          onPress={() => router.back()}
        />
        <Eyebrow color={palette.indigo}>Optional</Eyebrow>
        <AppText variant="h1">Connect Gmail</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          Automatic bank-alert import via read-only Gmail access. Track still
          works with clipboard and screenshot import alone.
        </AppText>

        <GlassCard style={styles.card} padding={spacing.xl}>
          <Row
            icon="eye-outline"
            title="What we will read"
            body="Bank alert emails from supported sender domains, using read-only access."
          />
          <Row
            icon="trash-outline"
            title="What we discard"
            body="Email content is kept only long enough to extract amount, merchant, date, and linked card — then deleted."
          />
          <Row
            icon="shield-checkmark-outline"
            title="What we never do"
            body="We never send your mail elsewhere, never request send/compose scopes, and never use inbox content for ads."
          />
        </GlassCard>

        <GlassCard
          style={[styles.soonCard, { borderColor: palette.glassBorder }]}
          padding={spacing.xl}
        >
          <AppText variant="title">Coming soon</AppText>
          <AppText variant="small" color={palette.textSecondary}>
            Gmail connection is not available yet. We will not mark this as
            connected until a real Google OAuth session is completed and verified.
          </AppText>
          <PillButton
            label="Coming soon"
            icon="mail-outline"
            disabled
            fullWidth
            size="lg"
          />
        </GlassCard>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={palette.indigo} />
      <View style={styles.rowText}>
        <AppText variant="body">{title}</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  card: { gap: spacing.lg },
  soonCard: { gap: spacing.md, borderWidth: 1 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowText: { flex: 1, gap: 4 },
});
