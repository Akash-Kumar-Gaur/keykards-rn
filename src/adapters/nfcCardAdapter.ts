/**
 * NFC card adapter — thin wrapper around react-native-nfc-manager IsoDep.
 * Android only for v1. iOS returns a typed "coming soon" result without
 * requesting Apple's payment-card reader entitlement.
 *
 * Security: extracted PAN/expiry stay in the returned object / in-memory store.
 * Never write to disk, never send to Supabase, never pass PAN to logger.
 *
 * Note: Android NFC is an *install-time* permission — there is no OS runtime
 * dialog like camera. If nothing happens, check Metro logs for [NFC] lines.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '@/lib/logger';
import { readEmvCard, type EmvReadResult } from '@/lib/emv/readEmvCard';

export type NfcAdapterStatus =
  | 'unsupported'
  | 'ios_coming_soon'
  | 'unavailable'
  | 'disabled'
  | 'ready';

export type NfcReadOutcome =
  | { ok: true; result: EmvReadResult }
  | {
      ok: false;
      reason: 'timeout' | 'cancelled' | 'failed' | 'ios_coming_soon' | 'unavailable' | 'disabled';
      message: string;
      /** Safe diagnostic crumbs for the UI / Metro (never includes PAN). */
      debug?: string;
    };

const READ_TIMEOUT_MS = 25_000;
/**
 * Retries happen while the card is still on the phone, so they only need a
 * short discovery window — this keeps the whole auto-retry pass inside the
 * budget below instead of adding another full 25s wait.
 */
const RETRY_DISCOVERY_TIMEOUT_MS = 4_000;
/** Extra silent attempts after the first (3 attempts total). */
const AUTO_RETRY_ATTEMPTS = 2;
const AUTO_RETRY_DELAY_MS = 700;
/** Ceiling on the time auto-retries may add after the first failed attempt. */
const AUTO_RETRY_BUDGET_MS = 9_000;
const TAG = '[NFC]';

/**
 * Android NfcAdapter reader-mode flags — keep the OS from handing the card to
 * Wallet/NDEF first. Values match android.nfc.NfcAdapter.
 */
const FLAG_READER_NFC_A = 0x1;
const FLAG_READER_NFC_B = 0x2;
const FLAG_READER_SKIP_NDEF_CHECK = 0x80;
const FLAG_READER_NO_PLATFORM_SOUNDS = 0x100;
const READER_MODE_FLAGS =
  FLAG_READER_NFC_A |
  FLAG_READER_NFC_B |
  FLAG_READER_SKIP_NDEF_CHECK |
  FLAG_READER_NO_PLATFORM_SOUNDS;

let NfcManager: typeof import('react-native-nfc-manager').default | null = null;
let NfcTech: typeof import('react-native-nfc-manager').NfcTech | null = null;

function runtimeHint(): string {
  const env = Constants.executionEnvironment; // 'storeClient' | 'standalone' | 'bare' …
  const ownership = Constants.appOwnership; // 'expo' | 'standalone' | null
  return `platform=${Platform.OS} execEnv=${String(env)} ownership=${String(ownership)}`;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function loadNfc(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    logger.info(TAG, 'loadNfc skipped — not Android', { os: Platform.OS });
    return false;
  }
  if (NfcManager && NfcTech) {
    logger.info(TAG, 'loadNfc — module already cached');
    return true;
  }
  try {
    logger.info(TAG, 'loadNfc — importing react-native-nfc-manager…', runtimeHint());
    const mod = await import('react-native-nfc-manager');
    NfcManager = mod.default;
    NfcTech = mod.NfcTech;
    logger.info(TAG, 'loadNfc — import OK', {
      hasDefault: Boolean(mod.default),
      hasIsoDep: Boolean(mod.NfcTech?.IsoDep),
      techKeys: mod.NfcTech ? Object.keys(mod.NfcTech).slice(0, 12) : [],
    });
    return true;
  } catch (err) {
    logger.warn(TAG, 'loadNfc — import FAILED (needs custom dev client with NFC native module)', {
      error: errMessage(err),
      hint: runtimeHint(),
    });
    return false;
  }
}

export async function getNfcStatus(): Promise<NfcAdapterStatus> {
  logger.info(TAG, 'getNfcStatus — start', runtimeHint());

  if (Platform.OS === 'ios') {
    logger.info(TAG, 'getNfcStatus → ios_coming_soon');
    return 'ios_coming_soon';
  }
  if (Platform.OS !== 'android') {
    logger.info(TAG, 'getNfcStatus → unsupported');
    return 'unsupported';
  }

  const ok = await loadNfc();
  if (!ok || !NfcManager) {
    logger.warn(TAG, 'getNfcStatus → unavailable (module not loaded)');
    return 'unavailable';
  }

  try {
    logger.info(TAG, 'getNfcStatus — calling isSupported()');
    const supported = await NfcManager.isSupported();
    logger.info(TAG, 'getNfcStatus — isSupported', { supported });
    if (!supported) {
      logger.warn(TAG, 'getNfcStatus → unavailable (hardware reports no NFC)');
      return 'unavailable';
    }

    logger.info(TAG, 'getNfcStatus — calling start()');
    await NfcManager.start();
    logger.info(TAG, 'getNfcStatus — start() OK');

    logger.info(TAG, 'getNfcStatus — calling isEnabled()');
    const enabled = await NfcManager.isEnabled();
    logger.info(TAG, 'getNfcStatus — isEnabled', { enabled });

    // Android NFC permission is install-time — no runtime prompt is expected.
    logger.info(
      TAG,
      'Note: Android NFC does not show a runtime permission dialog (unlike camera). Manifest NFC permission is enough.',
    );

    const status: NfcAdapterStatus = enabled ? 'ready' : 'disabled';
    logger.info(TAG, `getNfcStatus → ${status}`);
    return status;
  } catch (err) {
    logger.warn(TAG, 'getNfcStatus — exception', {
      error: errMessage(err),
      hint: runtimeHint(),
    });
    return 'unavailable';
  }
}

export interface NfcReadOptions {
  /**
   * Fired before every attempt (1-based) so the UI can hold one continuous
   * "reading" state instead of flashing failures between silent retries.
   */
  onAttempt?: (attempt: number, totalAttempts: number) => void;
  /**
   * Checked between attempts. Return false once the user has cancelled or left
   * so we don't re-open reader mode for a read nobody is waiting on.
   */
  shouldContinue?: () => boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Brief explainer should be shown by the UI before calling this.
 * On Android this starts IsoDep discovery.
 *
 * Contactless reads fail intermittently on cards that otherwise work, so a
 * failed exchange is retried silently a couple of times before the caller ever
 * sees a failure. Only `failed` is retried — a timeout already consumed the
 * discovery window, and cancelled/disabled/unavailable are terminal.
 */
export async function readCardViaNfc(
  options: NfcReadOptions = {},
): Promise<NfcReadOutcome> {
  logger.info(TAG, 'readCardViaNfc — start', runtimeHint());

  if (Platform.OS === 'ios') {
    logger.info(TAG, 'readCardViaNfc → ios_coming_soon');
    return {
      ok: false,
      reason: 'ios_coming_soon',
      message: 'Tap to read isn’t available on iPhone yet. Use Scan or Enter manually.',
      debug: 'ios stub',
    };
  }

  const status = await getNfcStatus();
  logger.info(TAG, 'readCardViaNfc — preflight status', { status });

  if (status === 'unavailable') {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Tap to read isn’t available on this device or in this install.',
      debug: `status=unavailable ${runtimeHint()}`,
    };
  }
  if (status === 'disabled') {
    return {
      ok: false,
      reason: 'disabled',
      message: 'NFC is turned off. Enable it in system settings, then try again.',
      debug: 'status=disabled — open NFC settings',
    };
  }

  const totalAttempts = AUTO_RETRY_ATTEMPTS + 1;
  let firstFailure: NfcReadOutcome | null = null;
  let budgetEndsAt = 0;
  let outcome: NfcReadOutcome = {
    ok: false,
    reason: 'failed',
    message: "Couldn't read this card — try Scan or Enter manually.",
    debug: 'no attempt ran',
  };

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    options.onAttempt?.(attempt, totalAttempts);
    outcome = await attemptCardRead(
      attempt === 1 ? READ_TIMEOUT_MS : RETRY_DISCOVERY_TIMEOUT_MS,
      attempt,
      totalAttempts,
    );

    if (outcome.ok) {
      if (attempt > 1) {
        logger.info(TAG, 'readCardViaNfc — recovered on auto-retry', { attempt });
      }
      return outcome;
    }

    if (outcome.reason !== 'failed') {
      // A retry that finds no card is less informative than the real failure.
      if (outcome.reason === 'timeout' && firstFailure) return firstFailure;
      return outcome;
    }

    if (!firstFailure) {
      firstFailure = outcome;
      budgetEndsAt = Date.now() + AUTO_RETRY_BUDGET_MS;
    }
    if (attempt === totalAttempts) break;
    if (Date.now() + AUTO_RETRY_DELAY_MS >= budgetEndsAt) {
      logger.warn(TAG, 'readCardViaNfc — auto-retry budget spent', {
        attempt,
        budgetMs: AUTO_RETRY_BUDGET_MS,
      });
      break;
    }

    logger.warn(TAG, 'readCardViaNfc — attempt failed, retrying silently', {
      attempt,
      totalAttempts,
      delayMs: AUTO_RETRY_DELAY_MS,
      debug: outcome.debug,
    });
    await delay(AUTO_RETRY_DELAY_MS);

    if (options.shouldContinue && !options.shouldContinue()) {
      logger.info(TAG, 'readCardViaNfc — abandoned between attempts (caller left)');
      return {
        ok: false,
        reason: 'cancelled',
        message: 'Read cancelled.',
        debug: `abandoned after attempt ${attempt}`,
      };
    }
  }

  // Surface the last attempt — it reflects how the card behaved most recently.
  logger.warn(TAG, 'readCardViaNfc — all attempts exhausted', {
    totalAttempts,
    reason: outcome.ok ? 'success' : outcome.reason,
  });
  return outcome;
}

/** One discovery + APDU exchange. Retry/backoff belongs to the caller. */
async function attemptCardRead(
  discoveryTimeoutMs: number,
  attempt: number,
  totalAttempts: number,
): Promise<NfcReadOutcome> {
  const manager = NfcManager;
  const tech = NfcTech;
  if (!manager || !tech) {
    logger.warn(TAG, 'attemptCardRead — manager/tech null after ready status');
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Tap to read isn’t available in this install. Try Scan or Enter manually.',
      debug: 'NfcManager or NfcTech null',
    };
  }

  logger.info(TAG, 'attemptCardRead — start', { attempt, totalAttempts, discoveryTimeoutMs });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    logger.warn(TAG, `attemptCardRead — TIMEOUT after ${discoveryTimeoutMs}ms, cancelling request`);
    manager.cancelTechnologyRequest().catch((err) => {
      logger.warn(TAG, 'cancelTechnologyRequest on timeout failed', {
        error: errMessage(err),
      });
    });
  }, discoveryTimeoutMs);

  let registeredReaderMode = false;

  try {
    // Force a clean reader-mode session so Android doesn't offer the tag to
    // Wallet / "Open with…" other apps (foreground-dispatch path).
    try {
      await manager.cancelTechnologyRequest({ delayMsAndroid: 0 });
    } catch {
      // none in flight
    }
    try {
      await manager.unregisterTagEvent();
    } catch {
      // none registered
    }

    logger.info(TAG, 'attemptCardRead — enableReaderMode (exclusive)', {
      flags: READER_MODE_FLAGS,
    });
    await manager.registerTagEvent({
      alertMessage: 'Hold your card near the back of your phone',
      invalidateAfterFirstRead: false,
      isReaderModeEnabled: true,
      readerModeFlags: READER_MODE_FLAGS,
      readerModeDelay: 250,
    });
    registeredReaderMode = true;

    const techs = [tech.IsoDep, tech.NfcA];
    logger.info(TAG, 'attemptCardRead — requestTechnology… waiting for tag', {
      techs: ['IsoDep', 'NfcA'],
      timeoutMs: discoveryTimeoutMs,
      readerMode: true,
    });

    // Options are ignored if already registered — we registered above on purpose.
    const matched = await manager.requestTechnology(techs);
    logger.info(TAG, 'attemptCardRead — technology matched', { matched });

    if (!matched) {
      throw new Error('Tag found but IsoDep/NfcA not available');
    }

    try {
      const tag = await manager.getTag();
      logger.info(TAG, 'attemptCardRead — tag meta (no PAN)', {
        idLen: tag?.id ? tag.id.length : 0,
        techs: tag?.techTypes ?? [],
      });
    } catch (err) {
      logger.warn(TAG, 'getTag failed (continuing)', { error: errMessage(err) });
    }

    try {
      if (typeof manager.setTimeout === 'function') {
        await manager.setTimeout(8000);
        logger.info(TAG, 'IsoDep transceive timeout set to 8000ms');
      }
    } catch (err) {
      logger.warn(TAG, 'setTimeout unavailable', { error: errMessage(err) });
    }

    logger.info(TAG, 'attemptCardRead — starting EMV APDU exchange');

    let apduCount = 0;
    const result = await readEmvCard(async (bytes) => {
      apduCount += 1;
      logger.info(TAG, 'APDU →', {
        n: apduCount,
        len: bytes.length,
        head: bytes
          .slice(0, 4)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
      });
      const resp = await manager.isoDepHandler.transceive(bytes);
      logger.info(TAG, 'APDU ←', {
        n: apduCount,
        len: resp.length,
        sw:
          resp.length >= 2
            ? `${resp[resp.length - 2].toString(16).padStart(2, '0')}${resp[resp.length - 1].toString(16).padStart(2, '0')}`
            : 'n/a',
      });
      return resp;
    });

    logger.info(TAG, 'attemptCardRead — SUCCESS', {
      attempt,
      panQuality: result.pan.quality,
      panDigitLen: result.pan.digits.length,
      hasExpiry: Boolean(result.expiryMonth && result.expiryYear),
      scheme: result.schemeHint,
      apduCount,
    });

    return { ok: true, result };
  } catch (err) {
    const msg = errMessage(err);
    if (timedOut) {
      logger.warn(TAG, 'attemptCardRead → timeout (no IsoDep tag seen)', {
        attempt,
        error: msg.slice(0, 120) || '(empty)',
        tip: 'Move card slowly; turn off Wallet contactless if Android offers another app',
      });
      return {
        ok: false,
        reason: 'timeout',
        message:
          "Couldn't find a card. Hold it flat against the back (near the camera), move slowly, and turn off Google Pay / Wallet contactless if Android offers to open another app.",
        debug: `timeout ${discoveryTimeoutMs}ms — no tag (Wallet often intercepts)`,
      };
    }
    if (/cancel/i.test(msg)) {
      logger.info(TAG, 'attemptCardRead → cancelled', { attempt, error: msg.slice(0, 120) });
      return {
        ok: false,
        reason: 'cancelled',
        message: 'Read cancelled.',
        debug: `cancelled: ${msg.slice(0, 80)}`,
      };
    }
    logger.warn(TAG, 'attemptCardRead → failed', { attempt, error: msg.slice(0, 160) });
    const isNoData = msg === 'NO_EMV_DATA';
    return {
      ok: false,
      reason: 'failed',
      message: isNoData
        ? "This card connected but won't share number/expiry over NFC (common on Amex and some bank chips). If Android offers Wallet or another app, dismiss it and use Scan or Enter manually in InWallet."
        : "Couldn't read this card — try Scan or Enter manually.",
      debug: `attempt ${attempt}/${totalAttempts}: ${msg.slice(0, 100)}`,
    };
  } finally {
    clearTimeout(timer);
    try {
      logger.info(TAG, 'attemptCardRead — cleanup cancel + unregister');
      await manager.cancelTechnologyRequest({ delayMsAndroid: 200 });
    } catch (err) {
      logger.info(TAG, 'cleanup cancel ignored', { error: errMessage(err).slice(0, 80) });
    }
    if (registeredReaderMode) {
      try {
        await manager.unregisterTagEvent();
      } catch (err) {
        logger.info(TAG, 'cleanup unregister ignored', {
          error: errMessage(err).slice(0, 80),
        });
      }
    }
  }
}

export function openNfcSettings(): void {
  logger.info(TAG, 'openNfcSettings');
  if (Platform.OS === 'android' && NfcManager) {
    NfcManager.goToNfcSetting().catch((err) => {
      logger.warn(TAG, 'goToNfcSetting failed', { error: errMessage(err) });
    });
  } else {
    logger.warn(TAG, 'openNfcSettings — manager not ready');
  }
}
