/**
 * Add card — on-device camera OCR (expo-camera + expo-mlkit-ocr).
 *
 * Camera frames are recognized locally and deleted immediately. Never uploaded.
 * Extracts PAN (Luhn), expiry, optional cardholder name. CVV is never scanned.
 * ~15s timeout → manual / NFC fallback (never a dead end).
 *
 * A PAN is only accepted once separate frames agree on it. Luhn alone is a weak
 * check — a single misread digit passes it about one time in ten — so the first
 * confident-looking frame is treated as a candidate, not an answer.
 *
 * On a hit the duplicate check runs *before* the reveal, so a card already in
 * the vault explains itself instead of silently resuming the camera. The preview
 * then stays mounted while ScanRevealChoreography plays over it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
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
import { CardScanOverlay, scanFrameRect } from '@/components/vault/CardScanOverlay';
import {
  ScanRevealChoreography,
  type ScanRevealCard,
} from '@/components/vault/ScanRevealChoreography';
import {
  parseCardOcrText,
  type CardOcrParseResult,
} from '@/lib/cardOcrParse';
import {
  findFieldRegions,
  mapRegionsToScreen,
  regionsWithinFrame,
  resolveImageSize,
  type OcrFieldRegion,
} from '@/lib/cardOcrRegions';
import { getSkipCaptureExplainer } from '@/lib/captureExplainerPrefs';
import { useCardCaptureStore } from '@/stores/cardCaptureStore';
import { useCardMorphStore } from '@/stores/cardMorphStore';
import { useAuthStore } from '@/stores/authStore';
import { lastFourFromNumber } from '@/lib/cardUtils';
import {
  signatureFromCapture,
  useDuplicateCardGuard,
} from '@/hooks/useDuplicateCardGuard';
import { logger } from '@/lib/logger';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Phase =
  | 'boot'
  | 'unsupported'
  | 'explainer'
  | 'permission'
  | 'scanning'
  | 'revealing'
  | 'timeout'
  | 'error';

type Reveal = { regions: OcrFieldRegion[]; card: ScanRevealCard };

const SCAN_TIMEOUT_MS = 15_000;
const FRAME_INTERVAL_MS = 700;
/**
 * Autofocus and exposure need a moment after the preview appears. The first
 * frame is usually soft, and a soft frame is exactly what produces a misread.
 */
const FOCUS_SETTLE_MS = 800;
/**
 * A single misread digit still passes Luhn roughly one time in ten, so one
 * frame is not proof. Require the same PAN off separate frames before believing
 * it — which also lets a second frame fill in expiry or name the first missed.
 */
const REQUIRED_AGREEING_READS = 2;

/** The PAN we're currently building confidence in. */
type Candidate = {
  panDigits: string;
  /** Frames that read this same PAN. */
  hits: number;
  read: CardOcrParseResult;
};

/**
 * Same physical card read twice — keep whichever fields each frame managed to
 * get. Only ever called when the PANs match, so this never mixes two cards, and
 * every field still comes off the card rather than being inferred.
 */
function mergeReads(
  prev: CardOcrParseResult,
  next: CardOcrParseResult,
): CardOcrParseResult {
  const haveExpiry = prev.expiryMonth != null && prev.expiryYear != null;
  const expirySource = haveExpiry ? prev : next;
  return {
    panDigits: prev.panDigits,
    expiryMonth: expirySource.expiryMonth,
    expiryYear: expirySource.expiryYear,
    cardholderName: prev.cardholderName ?? next.cardholderName,
    networkHint: prev.networkHint ?? next.networkHint,
  };
}

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
  const startMorph = useCardMorphStore((s) => s.start);
  const clearMorph = useCardMorphStore((s) => s.finish);

  const { width: winW, height: winH } = useWindowDimensions();
  const frame = useMemo(() => scanFrameRect(winW, winH), [winW, winH]);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const successRef = useRef(false);
  const startedAtRef = useRef(0);
  const candidateRef = useRef<Candidate | null>(null);

  // Held in a ref so a cards-query refresh can't restart the capture interval.
  const warnRef = useRef(warnIfDuplicate);
  useEffect(() => {
    warnRef.current = warnIfDuplicate;
  }, [warnIfDuplicate]);

  const ocrOk =
    Platform.OS !== 'web' && typeof isOcrSupported === 'function'
      ? isOcrSupported()
      : false;

  const [phase, setPhase] = useState<Phase>(() =>
    ocrOk ? 'boot' : 'unsupported',
  );
  const [status, setStatus] = useState('Align your card in the frame');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const cameraActive = phase === 'scanning' || phase === 'revealing';
  const beginScanningRef = useRef<() => Promise<void>>(async () => undefined);

  const goManual = useCallback(() => {
    router.replace('/card/new/manual' as Href);
  }, [router]);

  /**
   * Beat 4 of the reveal. Publish the card plus the rect it is currently resting
   * in, then navigate. The root overlay renders the same card at that same rect,
   * so the screen swap underneath it is invisible and the card carries over.
   */
  const handOffToForm = useCallback(() => {
    if (reveal) {
      startMorph(
        {
          lastFour: lastFourFromNumber(reveal.card.panDigits),
          network: reveal.card.networkHint ?? 'Visa',
          expiryMonth: reveal.card.expiryMonth,
          expiryYear: reveal.card.expiryYear,
          cardholderName: reveal.card.cardholderName,
        },
        frame,
      );
    }
    goManual();
  }, [reveal, startMorph, frame, goManual]);

  const goNfc = useCallback(() => {
    router.replace('/card/new/nfc' as Href);
  }, [router]);

  const goChooser = useCallback(() => {
    router.replace('/card/new' as Href);
  }, [router]);

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
    setReveal(null);
    candidateRef.current = null;
    clearMorph();
    setStatus('Align your card in the frame');
    setPhase('scanning');
  }, [ocrOk, permission, requestPermission, clearMorph]);

  useEffect(() => {
    beginScanningRef.current = beginScanning;
  }, [beginScanning]);

  // Resolve "don't show again" before flashing the privacy screen.
  useEffect(() => {
    if (phase !== 'boot') return;
    let cancelled = false;
    (async () => {
      const skip = await getSkipCaptureExplainer('scan');
      if (cancelled) return;
      logger.info('[Scan] screen mount', { skipExplainer: skip });
      if (skip) {
        void beginScanningRef.current();
      } else {
        setPhase('explainer');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

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
          // Embossed/low-contrast digits lose badly to JPEG artefacts; the
          // encode cost is worth it when a misread means a wrong card number.
          quality: 0.8,
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
          // A blank frame is not evidence against a PAN we already read, so the
          // candidate survives — only a *different* PAN discredits it.
          if (candidateRef.current) {
            setStatus('Almost there — keep the card steady');
          } else {
            setStatus(
              elapsed > 4000
                ? 'Still looking — hold steady, good light helps'
                : 'Align your card in the frame',
            );
          }
          return;
        }

        const previous = candidateRef.current;
        const agrees = previous?.panDigits === parsed.panDigits;
        candidateRef.current = {
          panDigits: parsed.panDigits,
          hits: agrees && previous ? previous.hits + 1 : 1,
          read:
            agrees && previous ? mergeReads(previous.read, parsed) : parsed,
        };

        if (candidateRef.current.hits < REQUIRED_AGREEING_READS) {
          setStatus(
            previous && !agrees
              ? 'Getting a mixed read — hold the card still'
              : 'Almost there — keep the card steady',
          );
          return;
        }

        // Same Luhn-valid PAN off separate frames — now it's trustworthy.
        const confirmed = candidateRef.current.read;
        successRef.current = true;
        scanningRef.current = false;

        // Checked before the reveal plays — a card already in the vault must
        // never animate success and then drop back to the camera unexplained.
        const sig = signatureFromCapture({
          panDigits: confirmed.panDigits,
          expiryMonth: confirmed.expiryMonth,
          expiryYear: confirmed.expiryYear,
        });
        if (sig) {
          const proceed = await warnRef.current({
            cardNumber: confirmed.panDigits,
            expiryMonth: sig.expiryMonth,
            expiryYear: sig.expiryYear,
          });
          if (cancelled) return;
          if (!proceed) {
            successRef.current = false;
            scanningRef.current = true;
            startedAtRef.current = Date.now();
            candidateRef.current = null;
            setStatus('Already in your vault — scan a different card');
            return;
          }
        }

        setCapture({
          panDigits: confirmed.panDigits,
          isPartial: false,
          expiryMonth: confirmed.expiryMonth,
          expiryYear: confirmed.expiryYear,
          networkHint: confirmed.networkHint,
          cardholderName: confirmed.cardholderName,
          source: 'scan',
          notice: null,
        });

        // Regions come from the confirming frame, so anything carried over from
        // an earlier read simply won't be located — TravelLabel fades those in
        // instead of flying them from a stale position.
        const read = recognition ?? { text: '', blocks: [] };
        const mapped = mapRegionsToScreen(
          findFieldRegions(read, confirmed),
          resolveImageSize(photo?.width, photo?.height, read),
          winW,
          winH,
        );
        const regions = regionsWithinFrame(mapped, frame, {
          viewport: { width: winW, height: winH },
        });

        logger.info('[Scan] OCR success', {
          hasExpiry: confirmed.expiryMonth != null,
          hasName: Boolean(confirmed.cardholderName),
          network: confirmed.networkHint,
          // mapped > located means the boxes were mapped but landed off the
          // card, i.e. preview crop and captured still disagree on this device.
          mappedRegions: mapped.length,
          locatedRegions: regions.length,
          agreeingReads: REQUIRED_AGREEING_READS,
        });

        setReveal({
          regions,
          card: {
            panDigits: confirmed.panDigits,
            expiryMonth: confirmed.expiryMonth,
            expiryYear: confirmed.expiryYear,
            cardholderName: confirmed.cardholderName,
            networkHint: confirmed.networkHint,
          },
        });
        setPhase('revealing');
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

    // Don't shoot the instant the preview appears — that frame is soft and a
    // soft frame is what produces a confident wrong answer.
    let id: ReturnType<typeof setInterval> | null = null;
    const warmUp = setTimeout(() => {
      void tick();
      id = setInterval(() => {
        void tick();
      }, FRAME_INTERVAL_MS);
    }, FOCUS_SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(warmUp);
      if (id) clearInterval(id);
      scanningRef.current = false;
    };
  }, [phase, setCapture, winW, winH, frame]);

  return (
    <View style={styles.root}>
      {cameraActive ? (
        /**
         * The camera stays mounted through the reveal. Unmounting it on success
         * tore down the preview surface and flashed black before the next
         * screen mounted — the reveal fades over it instead.
         */
        <View style={styles.cameraRoot}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            active={cameraActive}
            /** The scan loop captures ~every 900ms; the shutter animation on
             * each one reads as the whole screen flickering. */
            animateShutter={false}
          />
          <CardScanOverlay status={status} />
          {phase === 'revealing' && reveal ? (
            <ScanRevealChoreography
              frame={frame}
              regions={reveal.regions}
              card={reveal.card}
              onDone={handOffToForm}
            />
          ) : (
            <Pressable
              onPress={goChooser}
              hitSlop={12}
              style={[styles.closeCam, { top: insets.top + spacing.sm }]}
              accessibilityRole="button"
              accessibilityLabel="Close scan"
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          )}
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
