/**
 * view-card-share — public, unauthenticated share viewer.
 *
 * Thin deployment wrapper around the shared resolver. Kept as a distinct slug
 * for the mobile app + repo web viewer. See _shared/resolveShare.ts for logic.
 * Returns ciphertext only — client decrypts with the URL fragment key.
 *
 * Deploy: supabase functions deploy view-card-share --no-verify-jwt
 * Secrets: SHARE_DEBUG_REASONS=true (dev/staging only — adds precise reason)
 */

import { handleResolveShare } from '../_shared/resolveShare.ts';

Deno.serve(handleResolveShare);
