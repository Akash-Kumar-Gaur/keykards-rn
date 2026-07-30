/**
 * AppLockGate — root gate driven by useAppLock({ enforce }).
 *
 * CRITICAL: the navigation stack (children) stays MOUNTED while locked.
 * Lock UI is a full-screen overlay above that stack.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useAppLock } from '@/hooks/useAppLock';
import { APP_LOCK_TIMEOUT_MS, INSTANT_APP_LOCK } from '@/lib/appLockSession';

export function AppLockGate({
  children,
  enforce,
}: {
  children: React.ReactNode;
  enforce: boolean;
}) {
  const palette = usePalette();
  const { unlocked, checking, canAuthenticate, promptUnlock } = useAppLock({
    enforce,
  });

  const showLock = enforce && !unlocked;

  const minutes = Math.round(APP_LOCK_TIMEOUT_MS / 60_000);
  const unlockedCopy = INSTANT_APP_LOCK
    ? 'Authenticate with biometrics or your device passcode. InWallet locks the moment you leave the app.'
    : `Authenticate with biometrics or your device passcode. We only ask again after ${minutes} minutes in the background.`;

  return (
    <View style={[styles.root, { backgroundColor: palette.navy950 }]}>
      <View
        style={styles.stackHost}
        pointerEvents={showLock ? 'none' : 'auto'}
        accessibilityElementsHidden={showLock}
        importantForAccessibility={showLock ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>

      {showLock ? (
        <View
          style={[styles.lockOverlay, { backgroundColor: palette.navy950 }]}
          accessibilityViewIsModal
          pointerEvents="auto"
        >
          <GlowBackground />
          <View style={styles.content}>
            <View
              style={[styles.lockCircle, { backgroundColor: palette.indigoSoft }]}
            >
              <Ionicons name="finger-print" size={40} color={palette.indigo} />
            </View>
            <Eyebrow color={palette.indigo}>InWallet</Eyebrow>
            <AppText variant="h2" style={styles.title}>
              Unlock to continue
            </AppText>
            <AppText
              variant="body"
              color={palette.textSecondary}
              style={styles.subtitle}
            >
              {canAuthenticate
                ? unlockedCopy
                : 'Set up a device passcode or biometrics for the strongest protection.'}
            </AppText>
            <PillButton
              label={checking ? 'Authenticating…' : 'Unlock'}
              icon="lock-open"
              size="lg"
              onPress={promptUnlock}
              loading={checking}
              style={styles.button}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stackHost: { flex: 1 },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  lockCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { textAlign: 'center', marginTop: spacing.xs },
  subtitle: { textAlign: 'center', marginTop: spacing.xs },
  button: { marginTop: spacing.xl, minWidth: 200 },
});
