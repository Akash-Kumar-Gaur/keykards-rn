/**
 * Gmail opt-in explainer — required before OAuth (gmail.readonly).
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { markGmailConnected, disconnectGmail } from '@/adapters/gmailAdapter';
import { useAuthStore } from '@/stores/authStore';
import { useGmailConnection } from '@/hooks/useTransactions';
import { confirmDialog, showDialog } from '@/stores/dialogStore';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function GmailConnectScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: conn, refetch } = useGmailConnection(userId);
  const [busy, setBusy] = useState(false);
  const connected = conn?.status === 'connected';

  const onConnect = async () => {
    if (!userId) {
      showDialog({
        title: 'Sign in required',
        message: 'Sign in to connect Gmail for bank alerts.',
        icon: 'log-in-outline',
        tone: 'amber',
        actions: [{ label: 'Got it', variant: 'primary' }],
      });
      return;
    }
    setBusy(true);
    try {
      // OAuth is completed by the gmail-sync Edge Function / Auth provider.
      // Until Google client IDs are configured, we record an explicit opt-in
      // placeholder so the Track UI can show connected state in dev.
      const ok = await confirmDialog({
        title: 'Connect Gmail',
        message:
          'This requests read-only access to bank alert emails from supported senders. Email content is reviewed for transaction details and deleted within 30 days. Nothing is sold or shared.',
        icon: 'mail-outline',
        confirmLabel: 'I understand — continue',
      });
      if (!ok) return;
      await markGmailConnected({ userId });
      await refetch();
      showDialog({
        title: 'Gmail preference saved',
        message:
          'Automatic bank-alert import will begin when Gmail connection is available. Clipboard and screenshot import remain available.',
        icon: 'checkmark-circle-outline',
        tone: 'green',
      });
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await disconnectGmail(userId);
      await refetch();
    } finally {
      setBusy(false);
    }
  };

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
        <PillButton label="Back" variant="ghost" size="sm" icon="chevron-back" onPress={() => router.back()} />
        <Eyebrow color={palette.indigo}>Optional</Eyebrow>
        <AppText variant="h1">Connect Gmail</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          The most sensitive permission in KeyKards — only enable if you want automatic bank
          alert import. Track still works with clipboard and screenshot import alone.
        </AppText>

        <GlassCard style={styles.card} padding={spacing.xl}>
          <Row icon="eye-outline" title="What we read" body="Bank alert emails from supported sender domains, using read-only access." />
          <Row icon="trash-outline" title="What we discard" body="Email and SMS content is kept for up to 30 days if a transaction needs to be reviewed again, then deleted. We retain only the amount, merchant, date, and linked card." />
          <Row icon="shield-checkmark-outline" title="What we never do" body="We never send your mail elsewhere, never request send/compose scopes, and never use inbox content for ads." />
        </GlassCard>

        {connected ? (
          <>
            <AppText variant="small" color={palette.green}>
              Gmail sync enabled{conn?.email_address ? ` · ${conn.email_address}` : ''}.
            </AppText>
            <PillButton label="Disconnect Gmail" variant="ghost" onPress={onDisconnect} loading={busy} fullWidth />
          </>
        ) : (
          <PillButton
            label="Continue to connect"
            icon="mail-outline"
            onPress={onConnect}
            loading={busy}
            fullWidth
            size="lg"
          />
        )}
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
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowText: { flex: 1, gap: 4 },
});
