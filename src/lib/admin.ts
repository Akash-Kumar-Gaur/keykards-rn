/**
 * Admin email gate for internal screens (catalog review).
 * Set EXPO_PUBLIC_ADMIN_EMAILS=you@example.com,other@example.com
 */

export function getAdminEmails(): string[] {
  const raw = process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.trim().toLowerCase());
}
