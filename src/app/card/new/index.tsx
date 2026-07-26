/**
 * Add card — choose Scan, Tap to read (NFC, Android beta), or Manual entry.
 */

import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { useCardCaptureStore } from '@/stores/cardCaptureStore';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Method = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  badge?: string;
};

const METHODS: Method[] = [
  {
    id: 'scan',
    title: 'Scan card',
    subtitle: 'Scan the card number and expiry on this device',
    icon: 'scan-outline',
    href: '/card/new/scan' as Href,
  },
  {
    id: 'nfc',
    title: 'Tap to read',
    subtitle:
      Platform.OS === 'ios'
        ? 'Coming soon on iPhone'
        : 'Hold your card to the phone (Android, beta)',
    icon: 'wifi',
    href: '/card/new/nfc' as Href,
    badge: Platform.OS === 'android' ? 'Android · beta' : 'Coming soon',
  },
  {
    id: 'manual',
    title: 'Enter manually',
    subtitle: 'Type the number yourself — always available',
    icon: 'create-outline',
    href: '/card/new/manual' as Href,
  },
];

export default function NewCardChooserScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Drop any abandoned NFC/scan capture if the user returned to the chooser.
  useEffect(() => {
    useCardCaptureStore.getState().clear();
  }, []);

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View>
          <Eyebrow color={palette.indigo}>Vault</Eyebrow>
          <AppText variant="h2">Add card</AppText>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}>
        <AppText variant="body" color={palette.textSecondary} style={styles.lead}>
          Pick how you want to add it. Everything stays on this device until you save.
        </AppText>

        <View style={styles.list}>
          {METHODS.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => router.push(m.href)}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}. ${m.subtitle}`}
            >
              <GlassCard style={styles.card} padding={spacing.lg}>
                <View style={[styles.iconWrap, { backgroundColor: palette.indigoSoft }]}>
                  <Ionicons
                    name={m.icon}
                    size={22}
                    color={palette.indigo}
                    style={m.id === 'nfc' ? styles.nfcIcon : undefined}
                  />
                </View>
                <View style={styles.cardText}>
                  <View style={styles.titleRow}>
                    <AppText variant="title">{m.title}</AppText>
                    {m.badge ? (
                      <View style={[styles.badge, { backgroundColor: palette.indigoSoft }]}>
                        <AppText variant="caption" color={palette.indigo}>
                          {m.badge}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="small" color={palette.textSecondary}>
                    {m.subtitle}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
              </GlassCard>
            </Pressable>
          ))}
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
    gap: spacing.xl,
  },
  lead: { lineHeight: 22 },
  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcIcon: { transform: [{ rotate: '90deg' }] },
  cardText: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
