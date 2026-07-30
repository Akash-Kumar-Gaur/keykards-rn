/**
 * CameraPermissionExplainer — privacy copy before card OCR scan.
 * Frames stay on-device; never uploaded; CVV never scanned.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { PillButton } from '@/components/ui/PillButton';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function CameraPermissionExplainer({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: palette.indigoSoft }]}>
        <Ionicons name="scan-outline" size={32} color={palette.indigo} />
      </View>
      <Eyebrow color={palette.indigo} style={styles.eyebrow}>
        Before we continue
      </Eyebrow>
      <AppText variant="h2" style={styles.title}>
        Scan your card
      </AppText>
      <AppText variant="body" color={palette.textSecondary} style={styles.body}>
        InWallet will use the camera to read the card number, expiry, and name
        on this device. Frames are processed locally and discarded — nothing is
        uploaded.
      </AppText>

      <GlassCard style={styles.card} padding={spacing.lg}>
        <Row
          icon="phone-portrait-outline"
          text="On-device OCR only — camera frames never leave this phone"
        />
        <Row icon="eye-off-outline" text="Number stays masked until you choose to reveal" />
        <Row icon="shield-checkmark-outline" text="CVV is never scanned — enter it only if you need it" />
      </GlassCard>

      <PillButton
        label="Continue"
        icon="arrow-forward"
        size="lg"
        fullWidth
        onPress={onContinue}
      />
      <PillButton
        label="Enter manually instead"
        variant="ghost"
        size="lg"
        fullWidth
        onPress={onCancel}
      />
    </View>
  );
}

function Row({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={palette.indigo} style={styles.rowIcon} />
      <AppText variant="small" color={palette.textSecondary} style={styles.rowText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: spacing.md, alignItems: 'stretch' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    alignSelf: 'center',
  },
  title: { textAlign: 'center', alignSelf: 'center' },
  eyebrow: { alignSelf: 'center' },
  body: { textAlign: 'center' },
  card: { width: '100%', gap: spacing.md, marginVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    width: '100%',
  },
  rowIcon: { marginTop: 2 },
  rowText: { flex: 1, flexShrink: 1, lineHeight: 20 },
});
