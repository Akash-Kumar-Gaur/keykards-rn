/**
 * Typed crypto failures.
 *
 * The reveal flow used to catch every throw from the decrypt path and show one
 * "card details need refreshing" alert, which blamed a lost device key for what
 * were usually unrelated failures (missing WebCrypto polyfill, a Keychain read
 * error). Callers now branch on these classes and only claim key loss when the
 * key is genuinely gone or the ciphertext genuinely fails to authenticate.
 */

export class BiometricRequiredError extends Error {
  constructor(message = 'Biometric authentication required to reveal card details.') {
    super(message);
    this.name = 'BiometricRequiredError';
  }
}

/** WebCrypto / the native polyfill is unavailable (e.g. running under Expo Go). */
export class CryptoUnavailableError extends Error {
  constructor(message = 'Secure crypto is unavailable on this build.') {
    super(message);
    this.name = 'CryptoUnavailableError';
  }
}

/** SecureStore holds no data key, so existing ciphertext can never be read. */
export class MissingDataKeyError extends Error {
  constructor(message = 'No encryption key is stored on this device.') {
    super(message);
    this.name = 'MissingDataKeyError';
  }
}

/** Keychain/Keystore access itself failed — usually transient, worth a retry. */
export class KeyStoreUnavailableError extends Error {
  constructor(message = 'Secure storage could not be read.') {
    super(message);
    this.name = 'KeyStoreUnavailableError';
  }
}

/** AES-GCM authentication failed — wrong key or tampered ciphertext. */
export class DecryptionFailedError extends Error {
  constructor(message = 'Stored card data could not be decrypted with the current key.') {
    super(message);
    this.name = 'DecryptionFailedError';
  }
}

export type CryptoFailure =
  | BiometricRequiredError
  | CryptoUnavailableError
  | MissingDataKeyError
  | KeyStoreUnavailableError
  | DecryptionFailedError;

/** True when the card must be re-entered to be readable again. */
export function isUnrecoverableCardError(err: unknown): boolean {
  return err instanceof MissingDataKeyError || err instanceof DecryptionFailedError;
}
