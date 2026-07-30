/**
 * TEMP — Play Store Screenshot Mode (Android only).
 *
 * Hides the status bar via RN StatusBar and forces zero safe-area insets so
 * screens fill the display under immersive system UI. Native immersive mode
 * lives in plugins/withAndroidScreenshotMode.js (MainActivity).
 *
 * Remove with src/lib/screenshotMode.js when screenshot capture is done.
 */

import React, { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  useSafeAreaFrame,
} from 'react-native-safe-area-context';
import { SCREENSHOT_MODE } from '@/lib/screenshotMode';

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

const active = SCREENSHOT_MODE && Platform.OS === 'android';

/** Imperative status-bar hide + zero-inset override. Renders children unchanged otherwise. */
export function ScreenshotMode({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!active) return;

    StatusBar.setHidden(true, 'none');
    StatusBar.setTranslucent(true);

    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  if (!active) return <>{children}</>;

  return <ZeroSafeArea>{children}</ZeroSafeArea>;
}

function ZeroSafeArea({ children }: { children: React.ReactNode }) {
  const frame = useSafeAreaFrame();
  return (
    <SafeAreaInsetsContext.Provider value={ZERO_INSETS}>
      <SafeAreaFrameContext.Provider value={frame}>{children}</SafeAreaFrameContext.Provider>
    </SafeAreaInsetsContext.Provider>
  );
}
