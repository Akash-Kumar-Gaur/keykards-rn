/**
 * Crypto core — pure AES-256-GCM primitives.
 *
 * SENSITIVE: Every function here handles plaintext card data. Plaintext must
 * NEVER be logged, sent to crash reporting, or placed in a request body /
 * URL / query param as-is. Callers receive only ciphertext + iv + authTag.
 *
 * This module depends ONLY on the WebCrypto API (`globalThis.crypto.subtle`)
 * and is therefore fully unit-testable under Node (which provides WebCrypto
 * natively) with no React Native / Expo imports. On device, a WebCrypto
 * polyfill (react-native-quick-crypto) must be installed first — see
 * `lib/crypto/index.ts`.
 */

const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // 96-bit nonce, recommended for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit tag

export interface EncryptedField {
  /** base64 ciphertext (without the auth tag). */
  ciphertext: string;
  /** base64 initialization vector (96-bit). */
  iv: string;
  /** base64 authentication tag (128-bit). */
  authTag: string;
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error(
      'WebCrypto is unavailable. On a device you must install the crypto ' +
        'polyfill (react-native-quick-crypto) before calling crypto functions.',
    );
  }
  return c.subtle;
}

function getRandomBytes(length: number): Uint8Array {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.getRandomValues) {
    throw new Error('Secure random source (crypto.getRandomValues) unavailable.');
  }
  return c.getRandomValues(new Uint8Array(length));
}

// --- base64 helpers (portable: no Buffer / atob dependency) ------------------

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64_CHARS[(n >> 18) & 63] +
      B64_CHARS[(n >> 12) & 63] +
      B64_CHARS[(n >> 6) & 63] +
      B64_CHARS[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64_CHARS[(n >> 18) & 63] +
      B64_CHARS[(n >> 12) & 63] +
      B64_CHARS[(n >> 6) & 63] +
      '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  // Strip padding and any non-base64 chars, then derive length from the number
  // of significant characters (4 chars -> 3 bytes).
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const outLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i]);
    const c1 = B64_CHARS.indexOf(clean[i + 1]);
    const c2 = B64_CHARS.indexOf(clean[i + 2]);
    const c3 = B64_CHARS.indexOf(clean[i + 3]);
    const n = (c0 << 18) | (c1 << 12) | ((c2 & 63) << 6) | (c3 & 63);
    if (o < outLen) out[o++] = (n >> 16) & 255;
    if (o < outLen) out[o++] = (n >> 8) & 255;
    if (o < outLen) out[o++] = n & 255;
  }
  return out;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// --- key management ----------------------------------------------------------

/** Generate a fresh 256-bit key as raw bytes. */
export function generateRawKey(): Uint8Array {
  return getRandomBytes(KEY_LENGTH_BYTES);
}

/** Import raw key bytes into a non-extractable CryptoKey for AES-GCM. */
export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_LENGTH_BYTES) {
    throw new Error(`AES key must be ${KEY_LENGTH_BYTES} bytes (got ${raw.length}).`);
  }
  return getSubtle().importKey('raw', raw as unknown as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// --- encrypt / decrypt -------------------------------------------------------

/**
 * SENSITIVE: encrypt a plaintext card field with a raw AES-256 key.
 * The plaintext argument must never be logged by the caller.
 */
export async function encryptWithKey(
  plaintext: string,
  rawKey: Uint8Array,
): Promise<EncryptedField> {
  const key = await importAesKey(rawKey);
  const iv = getRandomBytes(IV_LENGTH_BYTES);
  const encoded = encoder.encode(plaintext);

  const combined = new Uint8Array(
    await getSubtle().encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: AUTH_TAG_LENGTH_BYTES * 8 },
      key,
      encoded as unknown as BufferSource,
    ),
  );

  // WebCrypto appends the auth tag to the ciphertext; split it out so callers
  // get the {ciphertext, iv, authTag} shape they expect.
  const tagStart = combined.length - AUTH_TAG_LENGTH_BYTES;
  const ciphertext = combined.slice(0, tagStart);
  const authTag = combined.slice(tagStart);

  return {
    ciphertext: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
    authTag: bytesToBase64(authTag),
  };
}

/**
 * SENSITIVE: decrypt a field back to plaintext with a raw AES-256 key.
 * The returned plaintext must be held only in ephemeral in-memory state and
 * never logged / persisted.
 */
export async function decryptWithKey(
  field: EncryptedField,
  rawKey: Uint8Array,
): Promise<string> {
  const key = await importAesKey(rawKey);
  const iv = base64ToBytes(field.iv);
  const ciphertext = base64ToBytes(field.ciphertext);
  const authTag = base64ToBytes(field.authTag);

  // Recombine ciphertext || tag for WebCrypto.
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const plaintextBuf = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: AUTH_TAG_LENGTH_BYTES * 8 },
    key,
    combined as unknown as BufferSource,
  );

  return decoder.decode(plaintextBuf);
}

export const CRYPTO_CONSTANTS = {
  KEY_LENGTH_BYTES,
  IV_LENGTH_BYTES,
  AUTH_TAG_LENGTH_BYTES,
} as const;
