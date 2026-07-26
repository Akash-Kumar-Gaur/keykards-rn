/**
 * Entry redirect — sequential phases after splash/reveal:
 *   share deep-link (cold start) → onboarding → tabs (guest or signed-in)
 *
 * Sign-in is no longer a forced root phase — guests browse signed-out Home and
 * open `/sign-in` as a modal. Share links bypass auth so recipients can view.
 */

import React, { useEffect, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import { deriveAppPhase } from '@/lib/appPhase';
import { parseShareIdFromUrl, parseShareKeyFromUrl } from '@/lib/cardShare';
import { shareLinkKeyCache } from '@/lib/shareLinkKeyCache';
import { useAppLockStore } from '@/stores/appLockStore';

export default function Index() {
  const seen = useOnboardingStore((s) => s.seen);
  const onboardingReady = useOnboardingStore((s) => s.ready);
  const authInitializing = useAuthStore((s) => s.initializing);
  const session = useAuthStore((s) => s.session);
  const unlocked = useAppLockStore((s) => s.unlocked);
  const [shareId, setShareId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    Linking.getInitialURL().then((url) => {
      if (!alive) return;
      const id = parseShareIdFromUrl(url);
      const key = parseShareKeyFromUrl(url);
      if (id && key) shareLinkKeyCache.set(id, key);
      setShareId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (shareId === undefined) return null;
  if (shareId) {
    return <Redirect href={`/shared/${shareId}` as Href} />;
  }

  const bootReady = onboardingReady && !authInitializing;
  const hasSession = Boolean(session);
  const phase = deriveAppPhase({
    bootReady,
    onboardingSeen: seen,
    hasSession,
    lockEnforced: seen && hasSession,
    unlocked,
  });

  if (phase === 'loading') return null;
  if (phase === 'onboarding') return <Redirect href="/onboarding" />;
  // guest + unlocked (+ locked handled by AppLockGate overlay) all land on tabs.
  return <Redirect href="/(tabs)" />;
}
