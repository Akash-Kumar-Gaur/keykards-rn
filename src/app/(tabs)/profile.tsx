/**
 * Profile / Account tab — profile card, preferences, sign-out, delete account.
 *
 * Theme: binary Light/Dark toggle matching the reference; System kept as a
 * secondary text action beneath (not dropped).
 *
 * Catalog review + Developer tools: gated by isAdminEmail only.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { Toggle } from '@/components/ui/Toggle';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { DisplayNameSheet } from '@/components/account/DisplayNameSheet';
import { radius, spacing, motion } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { isAdminEmail } from '@/lib/admin';
import { useAppTheme } from '@/providers/AppThemeProvider';
import { confirmDialog, showDialog } from '@/stores/dialogStore';
import { deleteAccountRemote } from '@/lib/accountDeletion';
import { resolveDisplayName } from '@/lib/displayName';
import { SUPPORT_EMAIL } from '@/lib/support';
import { logger } from '@/lib/logger';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useProfile } from '@/hooks/useProfile';

function initialsFromName(name: string | null): string | null {
  const fromName = name?.trim();
  if (!fromName) return null;
  const parts = fromName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  }
  return fromName.slice(0, 2).toUpperCase();
}

function PrefRow({
  label,
  onPress,
  trailing,
  showDivider,
  delay = 0,
}: {
  label: string;
  onPress?: () => void;
  trailing: React.ReactNode;
  showDivider?: boolean;
  delay?: number;
}) {
  const palette = useAppTheme().palette;
  const reduced = useReducedMotion();
  const press = useSharedValue(0);

  const anim = useAnimatedStyle(() => ({
    backgroundColor:
      press.value > 0 ? palette.indigoSoft : 'transparent',
    transform: [{ scale: 1 - press.value * 0.01 }],
  }));

  const body = (
    <Animated.View style={[styles.prefRow, anim]}>
      <AppText variant="body" style={styles.prefLabel}>
        {label}
      </AppText>
      {trailing}
    </Animated.View>
  );

  return (
    <AnimatedEntrance delay={delay}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            press.value = reduced
              ? withTiming(1, { duration: 80 })
              : withSpring(1, motion.springConfig);
          }}
          onPressOut={() => {
            press.value = reduced
              ? withTiming(0, { duration: 120 })
              : withSpring(0, motion.springConfig);
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {showDivider ? (
        <View style={[styles.divider, { backgroundColor: palette.glassBorder }]} />
      ) : null}
    </AnimatedEntrance>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setSession = useAuthStore((s) => s.setSession);
  const admin = isAdminEmail(user?.email);
  const { mode, setMode, resolvedMode, palette } = useAppTheme();
  const [deleting, setDeleting] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const { data: profile } = useProfile(user?.id);

  const displayName = useMemo(
    () => resolveDisplayName(user, profile?.displayName ?? null),
    [user, profile?.displayName],
  );
  const initials = useMemo(() => initialsFromName(displayName), [displayName]);

  /** Binary toggle reflects resolved light/dark; System is a secondary action. */
  const lightOn = resolvedMode === 'light';
  const onToggleTheme = (next: boolean) => {
    void setMode(next ? 'light' : 'dark');
  };

  const onSignOut = async () => {
    const ok = await confirmDialog({
      title: 'Sign out?',
      message:
        'You’ll return to the signed-out Home. Your cards stay encrypted on this device — sign in again anytime to manage them.',
      icon: 'log-out-outline',
      tone: 'indigo',
      confirmLabel: 'Sign out',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    await signOut();
  };

  const onDeleteAccount = async () => {
    const ok = await confirmDialog({
      title: 'Delete account permanently?',
      message:
        'This permanently deletes your KeyKards account and all cloud data — cards, benefits, milestones, transactions, points, statement imports, Gmail link, recovery keys, and any active card shares (shares are revoked immediately).\n\nEncryption keys on this device are wiped. This cannot be undone.',
      icon: 'trash-outline',
      tone: 'danger',
      confirmLabel: 'Delete forever',
      cancelLabel: 'Keep account',
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const result = await deleteAccountRemote();
      if (!result.ok) {
        showDialog({
          title: 'Deletion incomplete',
          message: result.message,
          icon: 'alert-circle-outline',
          tone: 'danger',
          actions: [{ label: 'OK', variant: 'primary' }],
        });
        return;
      }
      qc.clear();
      setSession(null);
      showDialog({
        title: 'Account deleted',
        message:
          'Your account and data have been removed. You can create a new account anytime.',
        icon: 'checkmark-circle-outline',
        tone: 'green',
      });
    } catch (err) {
      logger.warn('Delete account failed', err);
      showDialog({
        title: 'Deletion incomplete',
        message: `Something went wrong before we could confirm full removal. Email ${SUPPORT_EMAIL} so we can verify and finish deleting your account.`,
        icon: 'alert-circle-outline',
        tone: 'danger',
      });
    } finally {
      setDeleting(false);
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
            paddingBottom: insets.bottom + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedEntrance>
          <AppText variant="h1">Account</AppText>
        </AnimatedEntrance>

        <AnimatedEntrance delay={60}>
          <GlassCard style={styles.profileCard} padding={spacing.lg} elevation="raised">
            <Pressable
              onPress={() => {
                if (user) setNameSheetOpen(true);
              }}
              disabled={!user}
              accessibilityRole="button"
              accessibilityLabel={
                displayName ? 'Edit your name' : 'Add your name'
              }
              style={styles.userRow}
            >
              <View style={[styles.avatar, { backgroundColor: palette.indigoSoft }]}>
                {initials ? (
                  <AppText variant="title" color={palette.indigo}>
                    {initials}
                  </AppText>
                ) : (
                  <Ionicons name="person" size={22} color={palette.indigo} />
                )}
              </View>
              <View style={styles.userText}>
                <AppText variant="bodyLg" numberOfLines={1}>
                  {displayName ?? (user ? 'Add your name' : 'Not signed in')}
                </AppText>
                <AppText variant="caption" color={palette.textTertiary} numberOfLines={1}>
                  {user ? user.email ?? 'Email account' : 'Guest'}
                </AppText>
              </View>
              {user ? (
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={palette.textTertiary}
                />
              ) : null}
            </Pressable>
          </GlassCard>
        </AnimatedEntrance>

        <AnimatedEntrance delay={120}>
          <Eyebrow color={palette.textTertiary} style={styles.sectionLabel}>
            Preferences
          </Eyebrow>
        </AnimatedEntrance>

        <GlassCard style={styles.prefsCard} padding={0} elevation="flat">
          <PrefRow
            label="Theme"
            delay={140}
            showDivider={admin}
            trailing={
              <Toggle value={lightOn} onChange={onToggleTheme} variant="theme" />
            }
          />

          {admin ? (
            <>
              <PrefRow
                label="Catalog review"
                delay={180}
                showDivider
                onPress={() => router.push('/admin/catalog-review' as Href)}
                trailing={
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={palette.textTertiary}
                  />
                }
              />
              <PrefRow
                label="Developer tools"
                delay={220}
                onPress={() => router.push('/admin/dev-tools' as Href)}
                trailing={
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={palette.textTertiary}
                  />
                }
              />
            </>
          ) : null}
        </GlassCard>

        {mode !== 'system' ? (
          <AnimatedEntrance delay={240}>
            <Pressable
              onPress={() => void setMode('system')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Use system theme"
            >
              <AppText variant="caption" color={palette.indigo} style={styles.systemLink}>
                Use system setting
              </AppText>
            </Pressable>
          </AnimatedEntrance>
        ) : (
          <AnimatedEntrance delay={240}>
            <AppText variant="caption" color={palette.textTertiary} style={styles.systemLink}>
              Following system appearance
            </AppText>
          </AnimatedEntrance>
        )}

        {user ? (
          <>
            <AnimatedEntrance delay={280} style={styles.actions}>
              <Pressable
                onPress={onSignOut}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={[
                  styles.signOutBtn,
                  {
                    backgroundColor: palette.navy800,
                    borderColor: palette.glassBorderStrong,
                    opacity: deleting ? 0.6 : 1,
                  },
                ]}
              >
                <AppText variant="bodyLg">Sign out</AppText>
              </Pressable>
            </AnimatedEntrance>

            <AnimatedEntrance delay={320} style={styles.actions}>
              <Pressable
                onPress={onDeleteAccount}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                style={[
                  styles.deleteBtn,
                  {
                    backgroundColor: palette.dangerSoft,
                    borderColor: palette.danger,
                    opacity: deleting ? 0.6 : 1,
                  },
                ]}
              >
                <AppText variant="bodyLg" color={palette.danger}>
                  {deleting ? 'Deleting…' : 'Delete account'}
                </AppText>
              </Pressable>
            </AnimatedEntrance>
          </>
        ) : (
          <AnimatedEntrance delay={280} style={styles.actions}>
            <PillButton
              label="Sign in"
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => router.push('/sign-in')}
            />
          </AnimatedEntrance>
        )}
      </ScrollView>

      <DisplayNameSheet
        visible={nameSheetOpen}
        onClose={() => setNameSheetOpen(false)}
        userId={user?.id}
        initialName={displayName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  profileCard: { marginTop: spacing.sm },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userText: { gap: 4, flex: 1, minWidth: 0 },
  sectionLabel: { marginTop: spacing.md },
  prefsCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  prefLabel: { flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
  systemLink: {
    paddingHorizontal: 2,
    marginTop: -spacing.xs,
  },
  actions: { marginTop: spacing.sm },
  signOutBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
