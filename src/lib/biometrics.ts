/**
 * Biometric / device-passcode gating via expo-local-authentication.
 *
 * Used for (a) the app-open gate and (b) a fresh check immediately before any
 * card-detail reveal mid-session. A "fresh" check means we call
 * `authenticate()` at the moment of the sensitive action — we never cache a
 * pass result for later reuse.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { logger } from './logger';

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  /** True if the device can perform biometric OR device-passcode auth. */
  canAuthenticate: boolean;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return { hasHardware, isEnrolled, canAuthenticate: hasHardware && isEnrolled };
}

/**
 * Prompt for a fresh biometric / passcode check. Returns true on success.
 * `deviceFallback` allows the OS passcode when biometrics fail/unavailable.
 */
export async function authenticate(
  reason = 'Unlock InWallet',
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // Require a fresh check — do not allow the OS to reuse a recent unlock.
      disableDeviceFallback: false,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch (err) {
    // Never include auth internals in logs beyond the redacted error.
    logger.warn('Biometric authentication failed to run', err);
    return false;
  }
}
