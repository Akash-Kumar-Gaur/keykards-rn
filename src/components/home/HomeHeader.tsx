/**
 * HomeHeader — compact authenticated app chrome (not the marketing Hero).
 * Brand left, account control right — no floating card stack.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function HomeHeader({ onAccount }: { onAccount: () => void }) {
  const palette = usePalette();

  return (
    <View style={styles.row}>
      <AnimatedEntrance delay={0}>
        <View style={styles.brand}>
          <Eyebrow color={palette.indigo}>Your wallet</Eyebrow>
          <AppText variant="h2" style={styles.title}>
            KeyKards
          </AppText>
        </View>
      </AnimatedEntrance>
      <AnimatedEntrance delay={40}>
        <Pressable
          onPress={onAccount}
          accessibilityRole="button"
          accessibilityLabel="Account settings"
          hitSlop={8}
          style={[
            styles.accountBtn,
            {
              backgroundColor: palette.indigoSoft,
              borderColor: palette.glassBorder,
            },
          ]}
        >
          <Ionicons name="person-outline" size={20} color={palette.indigo} />
        </Pressable>
      </AnimatedEntrance>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  brand: { gap: 2 },
  title: { letterSpacing: 0.3 },
  accountBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
