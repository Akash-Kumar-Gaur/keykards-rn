/**
 * Track sub-routes (Gmail connect, etc.) — signed-in only.
 */

import { ThemedStack } from '@/components/ui/ThemedStack';
import { RequireAuth, AUTH_REASONS } from '@/lib/requireAuth';

export default function TrackStackLayout() {
  return (
    <RequireAuth message={AUTH_REASONS.trackGmail}>
      <ThemedStack />
    </RequireAuth>
  );
}
