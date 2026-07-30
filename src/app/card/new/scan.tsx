/**
 * Add card — on-device camera OCR (expo-camera + expo-mlkit-ocr).
 *
 * Camera frames are recognized locally and deleted immediately. Never uploaded.
 * Extracts PAN (Luhn), expiry, optional cardholder name. CVV is never scanned.
 * ~10s timeout → manual / NFC fallback (never a dead end).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { isSupported as isOcrSupported, recognizeText } from 'expo-mlkit-ocr';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { CameraPermissionExplainer } from '@/components/vault/CameraPermissionExplainer';
import { CardScanOverlay } from '@/components/vault/CardScanOverlay';
import { CaptureSuccessBurst } from '@/components/vault/CaptureSuccessBurst';
import { parseCardOcrText } from '@/lib/cardOcrParse';
import { useCardCaptureStore } from '@/stores/cardCaptureStore';
import { useAuthStore } from '@/stores/authStore';
import {
  signatureFromCapture,
  useDuplicateCardGuard,
} from '@/hooks/useDuplicateCardGuard';
import { logger } from '@/lib/logger';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Phase =
  | 'unsupported'
  | 'explainer'
  | 'permission'
  | 'scanning'
  | 'success'
  | 'timeout'
  | 'error';

const SCAN_TIMEOUT_MS = 10_000;
const FRAME_INTERVAL_MS = 900;

async function deleteCaptureFile(uri: string | null | undefined) {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* best-effort wipe */
  }
}

export default function ScanNewCardScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { warnIfDuplicate } = useDuplicateCardGuard(userId);
  const setCapture = useCardCaptureStore((s) => s.setCapture);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const successRef = useRef(false);
  const startedAtRef = useRef(0);

  const ocrOk =
    Platform.OS !== 'web' && typeof isOcrSupported === 'function'
      ? isOcrSupported()
      : false;

  const [phase, setPhase] = useState<Phase>(() =>
    ocrOk ? 'explainer' : 'unsupported',
  );
  const [status, setStatus] = useState('Align your card in the frame');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const goManual = useCallback(() => {
    router.replace('/card/new/manual' as Href);
  }, [router]);

  const goNfc = useCallback(() => {
    router.replace('/card/new/nfc' as Href);
  }, [router]);

  const goChooser = useCallback(() => {
    router.replace('/card/new' as Href);
  }, [router]);

  const finishCaptureToForm = useCallback(async () => {
    const capture = useCardCaptureStore.getState().capture;
    if (capture) {
      const sig = signatureFromCapture(capture);
      if (sig) {
        const proceed = await warnIfDuplicate({
          cardNumber: capture.panDigits,
          expiryMonth: sig.expiryMonth,
          expiryYear: sig.expiryYear,
        });
        if (!proceed) {
          useCardCaptureStore.getState().clear();
          successRef.current = false;
          setPhase('scanning');
          setStatus('Align your card in the frame');
          scanningRef.current = true;
          startedAtRef.current = Date.now();
          return;
        }
      }
    }
    goManual();
  }, [goManual, warnIfDuplicate]);

  const beginScanning = useCallback(async () => {
    if (!ocrOk) {
      setPhase('unsupported');
      return;
    }
    let perm = permission;
    if (!perm?.granted) {
      setPhase('permission');
      perm = await requestPermission();
    }
    if (!perm?.granted) {
      setErrorMessage(
        'Camera access is needed to scan. You can enter the card manually instead.',
      );
      setPhase('error');
      return;
    }
    successRef.current = false;
    busyRef.current = false;
    scanningRef.current = true;
    startedAtRef.current = Date.now();
    setStatus('Align your card in the frame');
    setPhase('scanning');
  }, [ocrOk, permission, requestPermission]);

  // Capture loop — take a still, OCR on-device, delete file, parse.
  useEffect(() => {
    if (phase !== 'scanning') return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled || !scanningRef.current || successRef.current) return;
      if (busyRef.current) return;

      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed >= SCAN_TIMEOUT_MS) {
        scanningRef.current = false;
        setPhase('timeout');
        return;
      }

      const cam = cameraRef.current;
      if (!cam) return;

      busyRef.current = true;
      let uri: string | null = null;
      try {
        const photo = await cam.takePictureAsync({
          quality: 0.55,
          shutterSound: false,
          skipProcessing: true,
        });
        uri = photo?.uri ?? null;
        if (!uri || cancelled || successRef.current) {
          await deleteCaptureFile(uri);
          return;
        }

        const recognition = await recognizeText(uri);
        await deleteCaptureFile(uri);
        uri = null;

        if (cancelled || successRef.current) return;

        const parsed = parseCardOcrText(recognition?.text ?? '');
        if (!parsed) {
          setStatus(
            elapsed > 4000
              ? 'Still looking — hold steady, good light helps'
              : 'Align your card in the frame',
          );
          return;
        }

        // Accept only Luhn-valid PAN (parser already enforces).
        successRef.current = true;
        scanningRef.current = false;
        setCapture({
          panDigits: parsed.panDigits,
          isPartial: false,
          expiryMonth: parsed.expiryMonth,
          expiryYear: parsed.expiryYear,
          networkHint: parsed.networkHint,
          cardholderName: parsed.cardholderName,
          source: 'scan',
          notice: null,
        });
        logger.info('[Scan] OCR success', {
          hasExpiry: parsed.expiryMonth != null,
          hasName: Boolean(parsed.cardholderName),
          network: parsed.networkHint,
        });
        setPhase('success');
      } catch (err) {
        await deleteCaptureFile(uri);
        if (!cancelled) {
          logger.warn('[Scan] frame OCR failed', err);
          setStatus('Having trouble reading — keep the card flat');
        }
      } finally {
        busyRef.current = false;
      }
    };

    const id = setInterval(() => {
      void tick();
    }, FRAME_INTERVAL_MS);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(id);
      scanningRef.current = false;
    };
  }, [phase, setCapture]);

  return (
    <View style={styles.root}>
      {phase === 'scanning' ? (
        <View style={styles.cameraRoot}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            active={phase === 'scanning'}
          />
          <CardScanOverlay status={status} />
          <Pressable
            onPress={goChooser}
            hitSlop={12}
            style={[styles.closeCam, { top: insets.top + spacing.sm }]}
            accessibilityRole="button"
            accessibilityLabel="Close scan"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <>
          <GlowBackground />
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable onPress={goChooser} hitSlop={12} style={styles.back}>
              <Ionicons
                name="chevron-back"
                size={24}
                color={palette.textPrimary}
              />
            </Pressable>
            <View>
              <Eyebrow color={palette.indigo}>Scan</Eyebrow>
              <AppText variant="h2">Camera scan</AppText>
            </View>
          </View>

          <View
            style={[
              styles.body,
              { paddingBottom: insets.bottom + spacing.xl },
            ]}
          >
            {phase === 'explainer' ? (
              <CameraPermissionExplainer
                onContinue={() => void beginScanning()}
                onCancel={goManual}
              />
            ) : null}

            {phase === 'permission' ? (
              <>
                <AppText variant="title">Allow camera access</AppText>
                <AppText
                  variant="body"
                  color={palette.textSecondary}
                  style={styles.center}
                >
                  InWallet needs the camera to read your card on this device.
                </AppText>
                <PillButton
                  label="Allow camera"
                  icon="camera-outline"
                  size="lg"
                  fullWidth
                  onPress={() => void beginScanning()}
                />
                <PillButton
                  label="Enter manually"
                  variant="ghost"
                  size="lg"
                  fullWidth
                  onPress={goManual}
                />
              </>
            ) : null}

            {phase === 'unsupported' ? (
              <>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: palette.indigoSoft },
                  ]}
                >
                  <Ionicons
                    name="scan-outline"
                    size={36}
                    color={palette.indigo}
                  />
                </View>
                <AppText variant="h2" style={styles.center}>
                  Scan unavailable
                </AppText>
                <AppText
                  variant="body"
                  color={palette.textSecondary}
                  style={styles.center}
                >
                  On-device card scanning isn’t supported on this device. Enter
                  the card manually
                  {Platform.OS === 'android' ? ', or try Tap to read' : ''}.
                </AppText>
                <View style={styles.actions}>
                  {Platform.OS === 'android' ? (
                    <PillButton
                      label="Tap to read"
                      icon="wifi"
                      size="lg"
                      fullWidth
                      onPress={goNfc}
                    />
                  ) : null}
                  <PillButton
                    label="Enter manually"
                    icon="create-outline"
                    variant={Platform.OS === 'android' ? 'ghost' : 'primary'}
                    size="lg"
                    fullWidth
                    onPress={goManual}
                  />
                </View>
              </>
            ) : null}

            {phase === 'timeout' ? (
              <>
                <AppText variant="h2" style={styles.center}>
                  Couldn’t read the card
                </AppText>
                <AppText
                  variant="body"
                  color={palette.textSecondary}
                  style={styles.center}
                >
                  Try better lighting, or enter the details manually
                  {Platform.OS === 'android' ? ' / Tap to read' : ''}.
                </AppText>
                <View style={styles.actions}>
                  <PillButton
                    label="Try again"
                    icon="refresh"
                    size="lg"
                    fullWidth
                    onPress={() => void beginScanning()}
                  />
                  {Platform.OS === 'android' ? (
                    <PillButton
                      label="Tap to read"
                      icon="wifi"
                      variant="ghost"
                      size="lg"
                      fullWidth
                      onPress={goNfc}
                    />
                  ) : null}
                  <PillButton
                    label="Enter manually"
                    icon="create-outline"
                    variant="ghost"
                    size="lg"
                    fullWidth
                    onPress={goManual}
                  />
                </View>
              </>
            ) : null}

            {phase === 'error' ? (
              <>
                <AppText variant="h2" style={styles.center}>
                  Camera needed
                </AppText>
                <AppText
                  variant="body"
                  color={palette.textSecondary}
                  style={styles.center}
                >
                  {errorMessage}
                </AppText>
                <View style={styles.actions}>
                  <PillButton
                    label="Try again"
                    icon="camera-outline"
                    size="lg"
                    fullWidth
                    onPress={() => void beginScanning()}
                  />
                  <PillButton
                    label="Enter manually"
                    icon="create-outline"
                    variant="ghost"
                    size="lg"
                    fullWidth
                    onPress={goManual}
                  />
                </View>
              </>
            ) : null}

            {phase === 'success' ? (
              <CaptureSuccessBurst
                title="Card scanned"
                subtitle="Review the details — they’re masked until you reveal"
                onDone={() => {
                  void finishCaptureToForm();
                }}
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  closeCam: {
    position: 'absolute',
    left: spacing.xl,
    zIndex: 4,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
});
