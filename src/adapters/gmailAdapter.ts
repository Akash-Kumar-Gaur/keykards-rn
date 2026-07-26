/**
 * Gmail adapter (client) — opt-in connection state + helpers.
 * Actual mailbox reads run in Supabase Edge Function `gmail-sync` on cron
 * with gmail.readonly; this module only manages local/opt-in UX hooks.
 */

import { gmailBankQuery } from '@/lib/bankSenderDomains';
import {
  parseAllTransactions,
  parseTransactionText,
} from '@/lib/transactionParser';
import { supabase } from '@/lib/supabase';
import type { ParseResult, ParserMatchContext } from '@/types/track';

export const GMAIL_READONLY_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly';

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
 * Mark connection after OAuth completes (token stored by Edge Function).
 * Client never persists the refresh token in plaintext.
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
