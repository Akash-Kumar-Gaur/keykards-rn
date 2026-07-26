/**
 * Profile tab — minimal for Phase 1: shows auth state and a sign-out action so
 * the Supabase auth flow is fully exercisable end-to-end.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconBadge } from '@/components/ui/IconBadge';
import { spacing } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { isAdminEmail } from '@/lib/admin';
import { useAppTheme } from '@/providers/AppThemeProvider';
import { THEME_MODES, type ThemeMode } from '@/lib/themePreference';
import { confirmDialog } from '@/stores/dialogStore';

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const admin = isAdminEmail(user?.email);
  const { mode, setMode, hasDistinctLightVisuals, palette } = useAppTheme();

  const onSignOut = async () => {
    const ok = await confirmDialog({
      title: 'Log out?',
      message:
        'You’ll return to the signed-out Home. Your cards stay encrypted on this device — sign in again anytime to manage them.',
      icon: 'log-out-outline',
      tone: 'danger',
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    await signOut();
  };

  return (
    <View style={styles.root}>
      <GlowBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.huge,
            paddingBottom: insets.bottom + spacing.huge,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow color={palette.indigo}>Account</Eyebrow>
        <AppText variant="h1" style={styles.title}>
          Profile
        </AppText>

        <GlassCard style={styles.card}>
          <View style={styles.userRow}>
            <IconBadge icon="person" tone="indigo" size={44} />
            <View style={styles.userText}>
              <AppText variant="bodyLg">
                {user ? user.email ?? 'Signed in' : 'Not signed in'}
              </AppText>
              <AppText variant="small" color={palette.textSecondary}>
                {user ? 'Email account' : 'Sign in to sync across devices'}
              </AppText>
            </View>
          </View>
        </GlassCard>

        <AppText variant="caption" color={palette.textTertiary} style={styles.settingsLabel}>
          Appearance
        </AppText>
        <GlassCard style={styles.appearanceCard} padding={spacing.lg}>
          <AppText variant="small">Theme</AppText>
          <View
            style={[
              styles.themeTrack,
              {
                backgroundColor: palette.navy900,
                borderColor: palette.glassBorder,
              },
            ]}
          >
            {THEME_MODES.map((option) => {
              const selected = mode === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setMode(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.themeOption,
                    selected && {
                      backgroundColor: palette.indigo,
                      borderColor: 'transparent',
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={selected ? palette.textOnAccent : palette.textSecondary}
                  >
                    {THEME_LABELS[option]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {!hasDistinctLightVisuals ? (
            <AppText variant="caption" color={palette.textTertiary}>
              Light theme visuals are coming later; the preference is saved now.
            </AppText>
          ) : (
            <AppText variant="caption" color={palette.textTertiary}>
              Light uses a warm off-white canvas. Payment cards stay metallic in
              both themes.
            </AppText>
          )}
        </GlassCard>

        {user ? (
          <>
            {admin ? (
              <>
                <PillButton
                  label="Catalog review"
                  variant="ghost"
                  size="lg"
                  icon="construct-outline"
                  fullWidth
                  onPress={() => router.push('/admin/catalog-review' as Href)}
                  style={styles.action}
                />
                <PillButton
                  label="Dev tools"
                  variant="ghost"
                  size="lg"
                  icon="flask-outline"
                  fullWidth
                  onPress={() => router.push('/admin/dev-tools' as Href)}
                  style={styles.action}
                />
              </>
            ) : null}
            <PillButton
              label="Sign out"
              variant="ghost"
              size="lg"
              icon="log-out-outline"
              fullWidth
              onPress={onSignOut}
              style={styles.action}
            />
          </>
        ) : (
          <PillButton
            label="Sign in"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push('/sign-in')}
            style={styles.action}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: { marginTop: spacing.xs },
  card: { marginTop: spacing.lg },
  settingsLabel: { marginTop: spacing.lg },
  appearanceCard: { gap: spacing.md },
  themeTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  userText: { gap: spacing.xs, flex: 1 },
  action: { marginTop: spacing.lg },
});
