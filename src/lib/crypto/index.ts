/**
 * Device-facing crypto layer.
 *
 * SENSITIVE: wires the pure AES-GCM core (./core) to on-device key storage
 * (expo-secure-store) and the biometric gate. This is the module UI code will
 * eventually call in Phase 2 to encrypt/decrypt card fields. It is intentionally
 * NOT imported anywhere at app boot, so the app still runs under Expo Go (which
 * lacks the native crypto polyfill); actual encryption requires a dev build.
 *
 * Key handling rules enforced here:
 *  - The AES data key is generated on first use and stored ONLY in SecureStore
 *    (Keychain / Keystore). It is never sent to Supabase, never persisted to a
 *    Zustand store, never written to disk outside SecureStore.
 *  - Decryption requires a FRESH biometric check at call time.
 *  - Decrypted plaintext is returned to the caller, which must hold it only in
 *    the non-persisted, auto-clearing in-memory store (see stores/sensitive).
 */

import {
  EncryptedField,
  base64ToBytes,
  bytesToBase64,
  decryptWithKey,
  encryptWithKey,
  generateRawKey,
} from './core';
import { SECURE_KEYS, secureGet, secureSet } from '../secureStore';
import { requireFreshBiometric } from '../appLockSession';
import {
  BiometricRequiredError,
  CryptoUnavailableError,
  DecryptionFailedError,
  KeyStoreUnavailableError,
  MissingDataKeyError,
} from './errors';

let polyfillInstalled = false;

/**
 * Install the WebCrypto polyfill (react-native-quick-crypto) on native so that
 * `globalThis.crypto.subtle` is available. No-op under Node/tests (where
 * WebCrypto exists natively) and safe to call multiple times.
 */
export function ensureCryptoInstalled(): void {
  if (polyfillInstalled) return;
  const g = globalThis as { crypto?: Crypto };
  if (g.crypto && g.crypto.subtle) {
    polyfillInstalled = true;
    return;
  }
  try {
    // Lazy require so bundlers/Expo Go don't try to resolve native code at boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const quickCrypto = require('react-native-quick-crypto');
    if (typeof quickCrypto.install === 'function') {
      quickCrypto.install();
    }
  } catch {
    throw new CryptoUnavailableError(
      'The native crypto module is not present in this build. Card encryption ' +
        'requires a development/production build, not Expo Go.',
    );
  }
  const after = globalThis as { crypto?: Crypto };
  if (!after.crypto?.subtle) {
    throw new CryptoUnavailableError();
  }
  polyfillInstalled = true;
}

async function readStoredDataKey(): Promise<string | null> {
  try {
    return await secureGet(SECURE_KEYS.dataKey);
  } catch {
    // Distinguish "Keychain unreadable right now" from "no key exists" — the
    // former is transient and must never trigger key regeneration.
    throw new KeyStoreUnavailableError();
  }
}

/**
 * Load the AES data key for ENCRYPTION, creating one on first use.
 * Only the encrypt path may mint a key.
 */
async function getOrCreateRawDataKey(): Promise<Uint8Array> {
  ensureCryptoInstalled();
  const existing = await readStoredDataKey();
  if (existing) {
    return base64ToBytes(existing);
  }
  const raw = generateRawKey();
  await secureSet(SECURE_KEYS.dataKey, bytesToBase64(raw));
  return raw;
}

/**
 * Load the AES data key for DECRYPTION. Never creates a key: minting one here
 * would silently guarantee an auth-tag failure and, worse, overwrite the slot
 * that a retry could still have read.
 */
async function requireRawDataKey(): Promise<Uint8Array> {
  ensureCryptoInstalled();
  const existing = await readStoredDataKey();
  if (!existing) {
    throw new MissingDataKeyError();
  }
  return base64ToBytes(existing);
}

/** True when this device already holds an AES data key in SecureStore. */
export async function hasLocalDataKey(): Promise<boolean> {
  const existing = await readStoredDataKey();
  return Boolean(existing);
}

/**
 * SENSITIVE: return the raw data key for RECOVERY SETUP, creating one if none
 * exists yet (so a user can set a recovery passphrase before adding any card).
 * The returned bytes are wrapped in-memory and immediately scrubbed by the
 * caller — they are never uploaded in plaintext.
 */
export async function getRawDataKeyForRecoverySetup(): Promise<Uint8Array> {
  return getOrCreateRawDataKey();
}

/**
 * SENSITIVE: persist a data key recovered via the passphrase-unwrap flow.
 * Refuses to overwrite an existing key — recovery only runs on a device that
 * has none, and clobbering a live key would orphan locally-stored ciphertext.
 */
export async function storeRecoveredDataKey(rawKey: Uint8Array): Promise<void> {
  ensureCryptoInstalled();
  const existing = await readStoredDataKey();
  if (existing) {
    // A key already exists — nothing to recover onto. No-op is the safe choice.
    return;
  }
  if (rawKey.length !== 32) {
    throw new Error('Recovered key has an invalid length.');
  }
  await secureSet(SECURE_KEYS.dataKey, bytesToBase64(rawKey));
}

/**
 * SENSITIVE: encrypt a plaintext card field. The plaintext argument must never
 * be logged or transmitted as-is. Returns only ciphertext/iv/authTag, which is
 * what may be stored in Supabase.
 */
export async function encryptField(plaintext: string): Promise<EncryptedField> {
  const rawKey = await getOrCreateRawDataKey();
  try {
    return await encryptWithKey(plaintext, rawKey);
  } finally {
    // Best-effort scrub of the key copy held in this scope.
    rawKey.fill(0);
  }
}

/**
 * SENSITIVE: decrypt a field back to plaintext.
 *
 * Always requires a FRESH biometric/PIN via `requireFreshBiometric` — independent
 * of the app-level unlock timeout. Even if the user unlocked the app 30s ago,
 * revealing PAN/CVV prompts again. Result must stay in ephemeral sensitive store.
 */
export async function decryptField(
  field: EncryptedField,
  reason = 'Reveal card details',
): Promise<string> {
  const passed = await requireFreshBiometric(reason);
  if (!passed) {
    throw new BiometricRequiredError();
  }
  return decryptFieldUnlocked(field);
}

/**
 * SENSITIVE: decrypt AFTER the caller has already passed a fresh biometric.
 * Used to reveal PAN + CVV with a single prompt. Do not call without auth.
 */
export async function decryptFieldUnlocked(field: EncryptedField): Promise<string> {
  const rawKey = await requireRawDataKey();
  try {
    return await decryptWithKey(field, rawKey);
  } catch {
    // AES-GCM tag mismatch — the stored key cannot read this ciphertext.
    throw new DecryptionFailedError();
  } finally {
    rawKey.fill(0);
  }
}

/**
 * SENSITIVE: one biometric, then decrypt multiple fields (e.g. PAN + CVV).
 */
export async function decryptFields(
  fields: Record<string, EncryptedField>,
  reason = 'Reveal card details',
): Promise<Record<string, string>> {
  const passed = await requireFreshBiometric(reason);
  if (!passed) {
    throw new BiometricRequiredError();
  }
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    out[key] = await decryptFieldUnlocked(field);
  }
  return out;
}

export type { EncryptedField };
export {
  BiometricRequiredError,
  CryptoUnavailableError,
  DecryptionFailedError,
  KeyStoreUnavailableError,
  MissingDataKeyError,
  isUnrecoverableCardError,
} from './errors';
