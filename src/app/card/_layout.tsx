/**
 * Card stack routes — new / detail / edit / extras / share.
 * Entire stack requires a signed-in session (shared viewer lives under /shared).
 */

import { RequireAuth, AUTH_REASONS } from '@/lib/requireAuth';
import { ThemedStack } from '@/components/ui/ThemedStack';

export default function CardLayout() {
  return (
    <RequireAuth message={AUTH_REASONS.cardDetail}>
      <ThemedStack screenOptions={{ animation: 'slide_from_right' }} />
    </RequireAuth>
  );
}
