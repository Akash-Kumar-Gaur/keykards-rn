/**
 * Track sub-routes — checklist, calendar, protection, Gmail.
 */

import { ThemedStack } from '@/components/ui/ThemedStack';
import { RequireAuth, AUTH_REASONS } from '@/lib/requireAuth';

export default function TrackStackLayout() {
  return (
    <RequireAuth message={AUTH_REASONS.trackTools}>
      <ThemedStack />
    </RequireAuth>
  );
}
