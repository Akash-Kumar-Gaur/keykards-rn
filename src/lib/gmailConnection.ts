/**
 * Gmail connection integrity helpers (pure — no Supabase imports).
 *
 * Connected UI must require both status === 'connected' and a verified OAuth
 * refresh token stored server-side. Status alone is not enough (blocks fake
 * opt-in rows written without a token exchange).
 */

export type GmailConnectionVerification = {
  status: string;
  hasVerifiedOauth: boolean;
};

export function isVerifiedGmailConnection(
  row: GmailConnectionVerification | null | undefined,
): boolean {
  return row?.status === 'connected' && row.hasVerifiedOauth === true;
}
