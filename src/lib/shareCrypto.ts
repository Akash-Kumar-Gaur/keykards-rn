/**
 * Share-link E2E helpers — per-share AES-256 key lives only in the URL fragment
 * (`#k=…`) and optionally on the owner’s device Secure Store for “copy again”.
 * The server never receives the key.
 *
 * Pure / unit-testable (WebCrypto). No React Native imports.
 */

import {
  CRYPTO_CONSTANTS,
  base64ToBytes,
  bytesToBase64,
  decryptWithKey,
  encryptWithKey,
  generateRawKey,
  type EncryptedField,
} from '@/lib/crypto/core';

/** URL-safe base64 (no +, /, =) for fragment embedding. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return base64ToBytes(padded + '='.repeat(padLen));
}

/** Generate a fresh 32-byte share key as base64url (for `#k=`). */
export function generateShareKeyB64Url(): string {
  return bytesToBase64Url(generateRawKey());
}

export function shareKeyBytesFromB64Url(keyB64Url: string): Uint8Array {
  const raw = base64UrlToBytes(keyB64Url.trim());
  if (raw.length !== CRYPTO_CONSTANTS.KEY_LENGTH_BYTES) {
    throw new Error('Invalid share key length');
  }
  return raw;
}

/**
 * SENSITIVE: encrypt PAN under a fresh share key. Digits-only plaintext.
 * Returns ciphertext fields (safe for the network) + keyB64Url (fragment only).
 */
export async function encryptPanForShare(panDigits: string): Promise<{
  field: EncryptedField;
  keyB64Url: string;
}> {
  const digits = panDigits.replace(/\D/g, '');
  const keyB64Url = generateShareKeyB64Url();
  const raw = shareKeyBytesFromB64Url(keyB64Url);
  try {
    const field = await encryptWithKey(digits, raw);
    return { field, keyB64Url };
  } finally {
    raw.fill(0);
  }
}

/**
 * SENSITIVE: decrypt share ciphertext with key from the URL fragment.
 * Returns digit string; caller formats for display.
 */
export async function decryptPanFromShare(
  field: EncryptedField,
  keyB64Url: string,
): Promise<string> {
  const raw = shareKeyBytesFromB64Url(keyB64Url);
  try {
    return await decryptWithKey(field, raw);
  } finally {
    raw.fill(0);
  }
}

export function formatPanGroups(digits: string): string {
  const d = digits.replace(/\D/g, '');
  return d.replace(/(.{4})/g, '$1 ').trim();
}

export function maskPanLastFour(lastFour: string): string {
  const four = lastFour.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `•••• •••• •••• ${four}`;
}
