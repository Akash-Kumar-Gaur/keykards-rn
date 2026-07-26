/**
 * EmptyVault — no fabricated cards; CTA to add the first one.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function EmptyVault({ onAdd }: { onAdd: () => void }) {
  const palette = usePalette();
  return (
    <AnimatedEntrance style={styles.root}>
      <View style={[styles.iconWrap, { backgroundColor: palette.indigoSoft }]}>
        <Ionicons name="card-outline" size={40} color={palette.indigo} />
      </View>
      <Eyebrow color={palette.indigo}>Vault</Eyebrow>
      <AppText variant="h2" style={styles.title}>
        No cards yet
      </AppText>
      <AppText variant="body" color={palette.textSecondary} style={styles.body}>
        Add your first card. Card numbers are encrypted on this device before they
        leave — we never store full card numbers or CVVs on our servers.
      </AppText>
      <PillButton
        label="Add your first card"
        icon="add"
        size="lg"
        onPress={onAdd}
        shimmer
        style={styles.cta}
      />
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center', marginTop: spacing.xs },
  body: { textAlign: 'center', marginTop: spacing.xs },
  cta: { marginTop: spacing.xl, minWidth: 220 },
});
