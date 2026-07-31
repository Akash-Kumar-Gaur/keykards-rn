/**
 * Persist "don't show again" for the NFC / camera privacy explainers.
 * Separate keys so skipping one doesn't skip the other.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/lib/logger';

export type CaptureExplainerKind = 'nfc' | 'scan';

const KEYS: Record<CaptureExplainerKind, string> = {
  nfc: 'inwallet.skipNfcExplainer.v1',
  scan: 'inwallet.skipScanExplainer.v1',
};

export async function getSkipCaptureExplainer(
  kind: CaptureExplainerKind,
): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEYS[kind]);
    return value === '1';
  } catch (err) {
    logger.warn(`[prefs] failed to read skip ${kind} explainer`, err);
    return false;
  }
}

export async function setSkipCaptureExplainer(
  kind: CaptureExplainerKind,
  skip: boolean,
): Promise<void> {
  try {
    if (skip) {
      await AsyncStorage.setItem(KEYS[kind], '1');
    } else {
      await AsyncStorage.removeItem(KEYS[kind]);
    }
  } catch (err) {
    logger.warn(`[prefs] failed to persist skip ${kind} explainer`, err);
  }
}
