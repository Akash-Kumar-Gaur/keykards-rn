/**
 * Auth gating — one pattern for every screen / CTA that needs a signed-in user.
 *
 * Prefer `RequireAuth` on route layouts (blocks the screen) and `useRequireAuth`
 * on buttons/CTAs (redirects before navigating into a guarded flow).
 */

import React, { useCallback, useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export const AUTH_REASONS = {
  addCard: 'Sign in to add your first card',
  cardDetail: 'Sign in to view your cards',
  trackGmail: 'Sign in to connect Gmail',
  trackTools: 'Sign in to use Track tools',
  admin: 'Sign in to continue',
  default: 'Sign in to continue',
} as const;

type EnsureAuthOpts = {
  /** Shown on the sign-in screen as contextual copy. */
  message?: string;
  /** Runs only when already authenticated. */
  then?: () => void;
  /** Prefer create-account tab when sending a brand-new user. */
  preferSignUp?: boolean;
};

/**
 * Imperative gate for CTAs (Vault +, Home Add, etc.).
 * Returns true if the user is signed in (and runs `then`); otherwise pushes Sign in.
 */
export function useRequireAuth() {
  const session = useAuthStore((s) => s.session);
  const router = useRouter();

  return useCallback(
    (opts?: EnsureAuthOpts): boolean => {
      if (session) {
        opts?.then?.();
        return true;
      }
      const reason = opts?.message ?? AUTH_REASONS.default;
      const mode = opts?.preferSignUp ? 'signUp' : 'signIn';
      router.push(
        `/sign-in?mode=${mode}&reason=${encodeURIComponent(reason)}` as Href,
      );
      return false;
    },
    [session, router],
  );
}

/**
 * Layout/screen wrapper — redirects unsigned users to Sign in and renders nothing
 * until a session exists. Use on stacks that must never mount without auth.
 */
export function RequireAuth({
  children,
  message = AUTH_REASONS.default,
  preferSignUp = false,
}: {
  children: React.ReactNode;
  message?: string;
  preferSignUp?: boolean;
}) {
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    if (session) return;
    const mode = preferSignUp ? 'signUp' : 'signIn';
    router.replace(
      `/sign-in?mode=${mode}&reason=${encodeURIComponent(message)}` as Href,
    );
  }, [initializing, session, router, message, preferSignUp]);

  if (initializing || !session) return null;
  return <>{children}</>;
}
