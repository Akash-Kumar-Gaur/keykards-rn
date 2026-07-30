/**
 * Root layout — sequential boot phases (not competing mounts):
 *
 *  1. Splash while fonts + onboarding_seen + auth session load
 *  2. Animated reveal
 *  3. !onboarding_seen → carousel
 *  4. no session → tabs (guest / signed-out Home); Sign in is optional
 *  5. session + lock required → biometric/PIN overlay (useAppLock)
 *  6. session + unlocked → same mounted Stack underneath (no remount)
 *
 * AppLockGate stays mounted after native splash so AppState listeners are not
 * torn down when the carousel or sign-in screen is showing. The lock UI is an
 * overlay — it never replaces the Expo Router Stack, so mid-flow state survives
 * background→foreground locks.
 */

import 'react-native-reanimated';
import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { appFonts } from '@/lib/fonts';
import { QueryProvider } from '@/providers/QueryProvider';
import { AppThemeProvider, usePalette } from '@/providers/AppThemeProvider';
import { SecurityLayer } from '@/components/security/SecurityLayer';
import { AppLockGate } from '@/components/security/AppLockGate';
import { ScreenshotMode } from '@/components/screenshot/ScreenshotMode';
import { AnimatedSplashReveal } from '@/components/splash/AnimatedSplashReveal';
import { AppDialogHost } from '@/components/ui/AppDialog';
import { ShareDeepLinkHandler } from '@/components/share/ShareDeepLinkHandler';
import { useAuthStore } from '@/stores/authStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useThemePreferenceStore } from '@/stores/themePreferenceStore';
import { clearDevDataOnReload } from '@/lib/devReset';

SplashScreen.preventAutoHideAsync();

function RootNavigation({
  revealDone,
  onRevealFinished,
  enforceAppLock,
}: {
  revealDone: boolean;
  onRevealFinished: () => void;
  enforceAppLock: boolean;
}) {
  const palette = usePalette();
  return (
    <SecurityLayer>
      <AppLockGate enforce={enforceAppLock}>
        {!revealDone ? (
          <AnimatedSplashReveal onFinished={onRevealFinished} />
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.navy950 },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="card" />
            <Stack.Screen name="track" />
            <Stack.Screen
              name="shared/[id]"
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
            <Stack.Screen name="admin" />
            <Stack.Screen
              name="sign-in"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        )}
      </AppLockGate>
    </SecurityLayer>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const initAuth = useAuthStore((s) => s.init);
  const authInitializing = useAuthStore((s) => s.initializing);
  const session = useAuthStore((s) => s.session);
  const initOnboarding = useOnboardingStore((s) => s.init);
  const onboardingReady = useOnboardingStore((s) => s.ready);
  const onboardingSeen = useOnboardingStore((s) => s.seen);
  const initTheme = useThemePreferenceStore((s) => s.init);
  const themeReady = useThemePreferenceStore((s) => s.ready);

  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [devResetDone, setDevResetDone] = useState(!__DEV__);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await clearDevDataOnReload();
      if (!cancelled) setDevResetDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!devResetDone) return;
    initAuth();
    initOnboarding();
    initTheme();
  }, [devResetDone, initAuth, initOnboarding, initTheme]);

  const bootReady =
    devResetDone &&
    (fontsLoaded || Boolean(fontError)) &&
    !authInitializing &&
    onboardingReady &&
    themeReady;

  useEffect(() => {
    if (!bootReady || nativeSplashHidden) return;
    SplashScreen.hideAsync().finally(() => setNativeSplashHidden(true));
  }, [bootReady, nativeSplashHidden]);

  const onRevealFinished = useCallback(() => setRevealDone(true), []);

  const enforceAppLock =
    nativeSplashHidden && revealDone && onboardingSeen && Boolean(session);

  if (!bootReady || !nativeSplashHidden) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ScreenshotMode>
          <KeyboardProvider>
            <QueryProvider>
              <AppThemeProvider>
                <RootNavigation
                  revealDone={revealDone}
                  onRevealFinished={onRevealFinished}
                  enforceAppLock={enforceAppLock}
                />
                <ShareDeepLinkHandler />
                <AppDialogHost />
              </AppThemeProvider>
            </QueryProvider>
          </KeyboardProvider>
        </ScreenshotMode>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
