/**
 * Single sequential root phase after splash/reveal:
 *   onboarding → guest (signed-out Home) | sign-in (optional) → lock → unlocked
 *
 * Guest is intentional: after onboarding (or logout), users can browse the
 * signed-out Home showcase and open Sign in as a modal — they are not trapped
 * on the auth screen. Sensitive routes still use RequireAuth.
 */

export type AppPhase =
  | 'loading'
  | 'onboarding'
  | 'guest'
  | 'locked'
  | 'unlocked';

export function deriveAppPhase(input: {
  bootReady: boolean;
  onboardingSeen: boolean;
  hasSession: boolean;
  lockEnforced: boolean;
  unlocked: boolean;
}): AppPhase {
  if (!input.bootReady) return 'loading';
  if (!input.onboardingSeen) return 'onboarding';
  // No account yet (or signed out) — tabs with HomeUnauthenticated.
  if (!input.hasSession) return 'guest';
  if (input.lockEnforced && !input.unlocked) return 'locked';
  return 'unlocked';
}
