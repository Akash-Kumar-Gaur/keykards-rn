/**
 * resolve-card-share — public, unauthenticated share viewer.
 *
 * Alias slug for the website resolver (the hosted keykards.redevolve.in site
 * calls this name). Shares the exact same logic as view-card-share so both
 * names resolve identically.
 *
 * Deploy: supabase functions deploy resolve-card-share --no-verify-jwt
 * Secrets: SHARE_DEBUG_REASONS=true (dev/staging only — adds precise reason)
 */

import { handleResolveShare } from '../_shared/resolveShare.ts';

Deno.serve(handleResolveShare);
