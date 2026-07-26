/**
 * Nested routes under /card/new — chooser, scan stub, NFC, manual form.
 * Auth is enforced by the parent `card/_layout` RequireAuth; this layout only
 * configures the nested stack. preferSignUp copy is handled at CTA entry points.
 */

import { ThemedStack } from '@/components/ui/ThemedStack';

export default function NewCardLayout() {
  return <ThemedStack screenOptions={{ animation: 'slide_from_right' }} />;
}
