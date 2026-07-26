/**
 * AddCardsButton — full-width primary CTA with a card icon and gradient fill,
 * plus a continuous shimmer sweep (via PillButton) and helper text below.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function AddCardsButton({ onPress }: { onPress: () => void }) {
  const palette = usePalette();
  return (
    <View style={styles.container}>
      <PillButton
        label="Add your cards"
        icon="card-outline"
        variant="primary"
        size="lg"
        fullWidth
        shimmer
        onPress={onPress}
      />
      <AppText variant="small" color={palette.textTertiary} style={styles.helper}>
        Free · takes under a minute
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    alignItems: 'center',
  },
  helper: {
    textAlign: 'center',
  },
});
