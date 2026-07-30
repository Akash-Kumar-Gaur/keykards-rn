/**
 * Gmail adapter (client) — connection state helpers.
 * Actual mailbox reads run in Supabase Edge Function `gmail-sync` on cron
 * with gmail.readonly; this module only manages connection UX hooks.
 *
 * Integrity: never treat a row as "connected" unless a verified OAuth refresh
 * token exists. `markGmailConnected` must only be called AFTER the Edge
 * Function has stored `refresh_token_encrypted` from a real token exchange.
 */

import { gmailBankQuery } from '@/lib/bankSenderDomains';
import {
  parseAllTransactions,
  parseTransactionText,
} from '@/lib/transactionParser';
import { supabase } from '@/lib/supabase';
import {
  isVerifiedGmailConnection,
  type GmailConnectionVerification,
} from '@/lib/gmailConnection';
import type { ParseResult, ParserMatchContext } from '@/types/track';

export const GMAIL_READONLY_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly';

export type GmailConnectionRow = GmailConnectionVerification & {
  user_id: string;
  connected_at: string;
  last_sync_at: string | null;
  email_address: string | null;
};

export { isVerifiedGmailConnection };

export function buildGmailSearchQuery(afterDays = 14): string {
  return gmailBankQuery(afterDays);
}

/** Parse a single email body the same way clipboard/OCR do. */
export function parseGmailBody(
  bodyText: string,
  ctx: ParserMatchContext,
): ParseResult {
  return parseTransactionText(bodyText, ctx);
}

/** Parse email body that may contain multiple alerts (forwarded digests). */
export function parseGmailBodyAll(
  bodyText: string,
  ctx: ParserMatchContext,
): ParseResult[] {
  return parseAllTransactions(bodyText, ctx);
}

export async function disconnectGmail(userId: string): Promise<void> {
  await supabase
    .from('gmail_connections')
    .update({ status: 'revoked', refresh_token_encrypted: null })
    .eq('user_id', userId);
}

/**
 * Mark connection AFTER OAuth completes and the Edge Function has stored the
 * refresh token. Client never persists the refresh token in plaintext.
 *
 * Do not call this from UI "opt-in" stubs — that creates a fake Connected state.
 */
export async function markGmailConnected(args: {
  userId: string;
  emailAddress?: string | null;
}): Promise<void> {
  await supabase.from('gmail_connections').upsert({
    user_id: args.userId,
    status: 'connected',
    email_address: args.emailAddress ?? null,
    connected_at: new Date().toISOString(),
  });
}
