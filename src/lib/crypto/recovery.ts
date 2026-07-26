/**
 * Recovery key wrapping — pure, WebCrypto-only (Node-testable, no Expo imports).
 *
 * ZERO-KNOWLEDGE MODEL:
 *  - The AES-256 data key (generated on-device, stored only in SecureStore) is
 *    the ONLY thing that decrypts card ciphertext. It never changes.
 *  - A RECOVERY PASSPHRASE (distinct from the app PIN/biometric) is stretched
 *    with a slow KDF into a wrapping key.
 *  - The data key is encrypted ("wrapped") under that wrapping key. Only the
 *    wrapped blob + salt + KDF params are uploaded to the server.
 *  - The passphrase and the plaintext data key NEVER leave the device. A full
 *    server/database compromise yields only the wrapped blob, which is useless
 *    without the passphrase (and the KDF makes offline guessing expensive).
 *
 * KDF CHOICE: PBKDF2-HMAC-SHA256.
 *  Argon2id is preferred in general, but it is NOT available in this app's
 *  WebCrypto polyfill (react-native-quick-crypto exposes subtle.deriveBits with
 *  PBKDF2, not Argon2), and no Argon2 RN dependency is installed. Per the spec's
 *  fallback we use PBKDF2 at OWASP-recommended strength and PERSIST the iteration
 *  count per record so it can be raised later without breaking old wrapped keys.
 */

import {
  EncryptedField,
  base64ToBytes,
  bytesToBase64,
  decryptWithKey,
  encryptWithKey,
} from './core';

/** OWASP (2023) PBKDF2-HMAC-SHA256 floor. Stored per-record for future upgrade. */
export const PBKDF2_ITERATIONS = 600_000;
/** 128-bit random per-user salt. */
export const RECOVERY_SALT_BYTES = 16;
/** Wrapping key length (AES-256). */
const WRAP_KEY_BITS = 256;
/** Minimum passphrase length — this is the only barrier if the DB is breached. */
export const RECOVERY_MIN_LENGTH = 12;

export interface WrappedKeyRecord {
  /** Serialized wrapped data key: `iv.ciphertext.authTag` (all base64). */
  wrappedKey: string;
  /** base64 random salt used for the KDF. */
  kdfSalt: string;
  /** PBKDF2 iteration count used to produce this record. */
  kdfIterations: number;
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error(
      'WebCrypto is unavailable. Install the crypto polyfill before recovery ops.',
    );
  }
  return c.subtle;
}

function getRandomBytes(length: number): Uint8Array {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.getRandomValues) {
    throw new Error('Secure random source unavailable.');
  }
  return c.getRandomValues(new Uint8Array(length));
}

const encoder = new TextEncoder();

/** Serialize/deserialize the wrapped-key blob to a single portable string. */
function serializeField(field: EncryptedField): string {
  return `${field.iv}.${field.ciphertext}.${field.authTag}`;
}

function deserializeField(blob: string): EncryptedField {
  const parts = blob.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed wrapped key blob.');
  }
  const [iv, ciphertext, authTag] = parts;
  return { iv, ciphertext, authTag };
}

/**
 * Stretch a passphrase into a raw 256-bit wrapping key via PBKDF2-HMAC-SHA256.
 * SENSITIVE: the passphrase is used only locally and never returned/logged.
 */
export async function deriveWrappingKey(
  passphrase: string,
  saltB64: string,
  iterations: number,
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(passphrase) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltB64) as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    WRAP_KEY_BITS,
  );
  return new Uint8Array(bits);
}

/**
 * Wrap (encrypt) the raw data key under a key derived from the passphrase.
 * Returns only the blob + salt + iteration count — safe to upload.
 * SENSITIVE: `rawDataKey` and `passphrase` must never be logged.
 */
export async function wrapDataKey(
  rawDataKey: Uint8Array,
  passphrase: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<WrappedKeyRecord> {
  const kdfSalt = bytesToBase64(getRandomBytes(RECOVERY_SALT_BYTES));
  const wrappingKey = await deriveWrappingKey(passphrase, kdfSalt, iterations);
  try {
    // Encrypt the data key (as base64 text) under the wrapping key.
    const field = await encryptWithKey(bytesToBase64(rawDataKey), wrappingKey);
    return { wrappedKey: serializeField(field), kdfSalt, kdfIterations: iterations };
  } finally {
    wrappingKey.fill(0);
  }
}

/**
 * Unwrap (decrypt) the data key with the passphrase. Throws on wrong passphrase
 * (AES-GCM tag mismatch) or malformed input.
 * SENSITIVE: returns the raw data key — caller stores it in SecureStore only.
 */
export async function unwrapDataKey(
  record: WrappedKeyRecord,
  passphrase: string,
): Promise<Uint8Array> {
  const wrappingKey = await deriveWrappingKey(
    passphrase,
    record.kdfSalt,
    record.kdfIterations,
  );
  try {
    const field = deserializeField(record.wrappedKey);
    const dataKeyB64 = await decryptWithKey(field, wrappingKey);
    return base64ToBytes(dataKeyB64);
  } finally {
    wrappingKey.fill(0);
  }
}

/** Passphrase strength result for the setup UI. */
export interface PassphraseStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  acceptable: boolean;
  hint: string;
}

/**
 * Length-first strength model. A 12+ char passphrase is the floor; extra length
 * and variety raise the score. Encourages passphrases over short passwords.
 */
export function evaluatePassphrase(passphrase: string): PassphraseStrength {
  const len = passphrase.length;
  if (len < RECOVERY_MIN_LENGTH) {
    return {
      score: 0,
      label: 'Too short',
      acceptable: false,
      hint: `Use at least ${RECOVERY_MIN_LENGTH} characters — a memorable phrase works well.`,
    };
  }

  const classes =
    (/[a-z]/.test(passphrase) ? 1 : 0) +
    (/[A-Z]/.test(passphrase) ? 1 : 0) +
    (/[0-9]/.test(passphrase) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(passphrase) ? 1 : 0);
  const hasSpace = /\s/.test(passphrase.trim());

  // Length dominates; character variety and multi-word phrasing add a little.
  let score = 1;
  if (len >= 16) score += 1;
  if (len >= 24 || hasSpace) score += 1;
  if (classes >= 3 && len >= 16) score += 1;
  score = Math.min(4, score) as 1 | 2 | 3 | 4;

  const labels: Record<number, PassphraseStrength['label']> = {
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  return {
    score: score as 1 | 2 | 3 | 4,
    label: labels[score],
    acceptable: true,
    hint:
      score >= 3
        ? 'Strong enough to resist offline guessing.'
        : 'Longer, multi-word passphrases are much harder to crack.',
  };
}
