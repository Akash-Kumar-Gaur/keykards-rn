/**
 * Post-create extras — add benefits/milestones or skip.
 * Centered composition when empty; scrolls when editors expand.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import {
  BenefitsSection,
  MilestonesSection,
} from '@/components/vault/BenefitsMilestones';
import { useCardBenefits, useCardMilestones } from '@/hooks/useCards';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function CardExtrasScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: benefits = [] } = useCardBenefits(id);
  const { data: milestones = [] } = useCardMilestones(id);

  const done = () => router.replace(`/card/${id}` as Href);

  return (
    <View style={styles.root}>
      <GlowBackground />
      <Pressable
        onPress={done}
        hitSlop={12}
        style={[styles.close, { top: insets.top + spacing.sm }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={24} color={palette.textPrimary} />
      </Pressable>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + spacing.huge,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centered}>
          <View style={[styles.iconWrap, { backgroundColor: palette.indigoSoft }]}>
            <Ionicons name="gift-outline" size={36} color={palette.indigo} />
          </View>
          <Eyebrow color={palette.indigo}>Almost done</Eyebrow>
          <AppText variant="h2" style={styles.title}>
            Add benefits?
          </AppText>
          <AppText variant="body" color={palette.textSecondary} style={styles.subtitle}>
            Optional — you can always add these later from the card screen.
          </AppText>

          {id ? (
            <View style={styles.sections}>
              <BenefitsSection cardId={id} benefits={benefits} />
              <MilestonesSection cardId={id} milestones={milestones} />
            </View>
          ) : null}

          <View style={styles.actions}>
            <PillButton
              label="Done"
              icon="checkmark"
              size="lg"
              fullWidth
              onPress={done}
            />
            <PillButton
              label="Add benefits later"
              variant="ghost"
              size="lg"
              fullWidth
              onPress={done}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  close: {
    position: 'absolute',
    left: spacing.xl,
    zIndex: 2,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center', marginTop: spacing.xs },
  subtitle: { textAlign: 'center', marginBottom: spacing.lg },
  sections: {
    width: '100%',
    gap: spacing.xxl,
    marginBottom: spacing.xl,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
