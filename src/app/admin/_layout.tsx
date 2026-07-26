/**
 * Admin tools — signed-in only (email allowlist still checked per screen).
 */

import { ThemedStack } from '@/components/ui/ThemedStack';
import { RequireAuth, AUTH_REASONS } from '@/lib/requireAuth';

export default function AdminLayout() {
  return (
    <RequireAuth message={AUTH_REASONS.admin}>
      <ThemedStack />
    </RequireAuth>
  );
}
