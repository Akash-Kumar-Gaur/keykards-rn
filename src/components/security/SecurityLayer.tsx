/**
 * SecurityLayer — privacy overlays (blur + screenshot notice).
 *
 * App-lock timeout / biometric decisions live in useAppLock (root gate).
 * This layer only:
 *  1. Blurs content while backgrounded (app-switcher privacy)
 *  2. Clears ephemeral decrypted plaintext on background
 *  3. Listens for iOS screenshots and shows a notice
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ScreenCapture from 'expo-screen-capture';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { clearSensitiveData } from '@/stores/sensitiveStore';
import { showDialog } from '@/stores/dialogStore';

export function SecurityLayer({ children }: { children: React.ReactNode }) {
  const palette = usePalette();
  const [obscured, setObscured] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const leavingForeground =
        appState.current === 'active' && next.match(/inactive|background/);
      const returningToForeground =
        appState.current.match(/inactive|background/) && next === 'active';

      if (leavingForeground) {
        setObscured(true);
        // Belt-and-suspenders with useAppLock — never leave plaintext visible.
        clearSensitiveData();
      }
      if (returningToForeground) {
        setObscured(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      showDialog({
        title: 'Screenshot detected',
        message:
          'For your security, avoid screenshots of card details. KeyKards cannot block screenshots on iOS, so keep any captures private.',
        icon: 'camera-outline',
        tone: 'amber',
        actions: [{ label: 'Got it', variant: 'primary' }],
      });
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.root}>
      {children}
      {obscured ? (
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={[styles.notice, { backgroundColor: palette.overlayScrim }]}>
            <View style={[styles.lockCircle, { backgroundColor: palette.indigoSoft }]}>
              <Ionicons name="lock-closed" size={28} color={palette.indigo} />
            </View>
            <AppText variant="title" style={styles.title}>
              KeyKards is protected
            </AppText>
            <AppText variant="small" color={palette.textSecondary}>
              Content hidden while the app is in the background
            </AppText>
          </View>
        </BlurView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { textAlign: 'center' },
});
