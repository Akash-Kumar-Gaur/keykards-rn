/**
 * Add card — camera scan stub.
 * Full OCR scan UI was scoped earlier but is not shipped yet; keep the entry
 * point so the three-option chooser stays honest, with Manual + NFC escapes.
 *
 * When OCR ships, extracted cardholder name must flow into CardCapturePayload
 * `.cardholderName` so CardForm can highlight-prefill Name on card (falling
 * back to the auth profile suggestion when OCR misses the name).
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function ScanNewCardScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View>
          <Eyebrow color={palette.indigo}>Scan</Eyebrow>
          <AppText variant="h2">Camera scan</AppText>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={[styles.iconWrap, { backgroundColor: palette.indigoSoft }]}>
          <Ionicons name="scan-outline" size={36} color={palette.indigo} />
        </View>
        <AppText variant="h2" style={styles.title}>
          Coming soon
        </AppText>
        <AppText variant="body" color={palette.textSecondary} style={styles.bodyText}>
          Camera scan isn’t available yet. On Android, try Tap to read, or enter
          the card manually.
        </AppText>

        <View style={styles.actions}>
          <PillButton
            label="Tap to read (Android)"
            icon="wifi"
            size="lg"
            fullWidth
            onPress={() => router.replace('/card/new/nfc' as Href)}
          />
          <PillButton
            label="Enter manually"
            icon="create-outline"
            variant="ghost"
            size="lg"
            fullWidth
            onPress={() => router.replace('/card/new/manual' as Href)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { textAlign: 'center' },
  bodyText: { textAlign: 'center', marginBottom: spacing.lg },
  actions: { width: '100%', gap: spacing.sm },
});
