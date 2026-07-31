/**
 * Add card — Tap to read (NFC / IsoDep EMV).
 * Android: permission explainer → pulsing wait → success burst → manual form.
 * iOS: Coming soon stub (no entitlement request).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { NfcPulseRings } from '@/components/vault/NfcPulseRings';
import { NfcPermissionExplainer } from '@/components/vault/NfcPermissionExplainer';
import { CaptureSuccessBurst } from '@/components/vault/CaptureSuccessBurst';
import {
  getNfcStatus,
  openNfcSettings,
  readCardViaNfc,
} from '@/adapters/nfcCardAdapter';
import { useCardCaptureStore } from '@/stores/cardCaptureStore';
import { useAuthStore } from '@/stores/authStore';
import {
  signatureFromCapture,
  useDuplicateCardGuard,
} from '@/hooks/useDuplicateCardGuard';
import { getSkipCaptureExplainer } from '@/lib/captureExplainerPrefs';
import { logger } from '@/lib/logger';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Phase =
  | 'boot'
  | 'ios_stub'
  | 'explainer'
  | 'listening'
  | 'success'
  | 'partial'
  | 'duplicate'
  | 'error';

export default function NfcNewCardScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { warnIfDuplicate } = useDuplicateCardGuard(userId);
  const setCapture = useCardCaptureStore((s) => s.setCapture);
  const [phase, setPhase] = useState<Phase>(
    Platform.OS === 'ios' ? 'ios_stub' : 'boot',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const reading = useRef(false);
  /** Bumped on cancel / unmount so a stale read can't overwrite the phase. */
  const readSeq = useRef(0);
  /** True when the user chose "Don't show again" on the privacy explainer. */
  const skipExplainerRef = useRef(false);
  const startReadRef = useRef<() => Promise<void>>(async () => undefined);

  const goManual = useCallback(() => {
    router.replace('/card/new/manual' as Href);
  }, [router]);

  const goScan = useCallback(() => {
    router.replace('/card/new/scan' as Href);
  }, [router]);

  /**
   * After a successful / partial NFC read, warn about duplicates before the
   * form opens — last four + expiry are already known from the capture.
   *
   * Cancel means "don't add this card": the capture is dropped and the user
   * stays on this screen ready to read a different card. It must never fall
   * through to the form with the duplicate pre-filled.
   */
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
          logger.info('[NFC UI] duplicate cancelled — discarding capture, staying on read');
          useCardCaptureStore.getState().clear();
          setPartialNotice(null);
          setErrorMessage(null);
          setStatusNote(null);
          setPhase('duplicate');
          return;
        }
      }
    }
    goManual();
  }, [goManual, warnIfDuplicate]);

  const startRead = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    readSeq.current += 1;
    const seq = readSeq.current;
    /** False once the user cancels or leaves — stale results must be dropped. */
    const isCurrent = () => readSeq.current === seq;

    setPhase('listening');
    setErrorMessage(null);
    setStatusNote(null);
    logger.info('[NFC UI] startRead', { seq });

    const status = await getNfcStatus();
    if (!isCurrent()) return;
    logger.info('[NFC UI] status before read', { status });

    if (status === 'disabled') {
      setErrorMessage('NFC is turned off. Enable it in system settings, then try again.');
      setPhase('error');
      reading.current = false;
      return;
    }
    if (status === 'unavailable') {
      setErrorMessage(
        'Tap to read isn’t available in this install. Try Scan or Enter manually.',
      );
      setPhase('error');
      reading.current = false;
      return;
    }

    logger.info(
      '[NFC UI] Note: Android NFC has no runtime permission prompt — listening for tag now',
    );

    const outcome = await readCardViaNfc({
      // Silent retries stay one continuous "reading" state — no error flash.
      onAttempt: (attempt, totalAttempts) => {
        if (!isCurrent()) return;
        if (attempt === 1) return;
        setStatusNote('Hold steady — still reading…');
        logger.info('[NFC UI] retrying read', { attempt, totalAttempts });
      },
      shouldContinue: isCurrent,
    });
    if (!isCurrent()) {
      logger.info('[NFC UI] stale outcome ignored', { seq });
      return;
    }
    reading.current = false;
    setStatusNote(null);
    logger.info('[NFC UI] outcome', {
      ok: outcome.ok,
      reason: outcome.ok ? 'success' : outcome.reason,
      debug: outcome.ok ? undefined : outcome.debug,
    });

    if (!outcome.ok) {
      setErrorMessage(outcome.message);
      setPhase('error');
      return;
    }

    const { result } = outcome;
    const isPartial = result.pan.quality !== 'full';
    logger.info('[NFC UI] read ok', {
      panQuality: result.pan.quality,
      scheme: result.schemeHint ?? null,
    });

    const notice = isPartial
      ? 'Your bank only shares partial card details this way — please complete the rest manually.'
      : null;

    setCapture({
      panDigits: result.pan.digits,
      isPartial,
      expiryMonth: result.expiryMonth,
      expiryYear: result.expiryYear,
      networkHint: result.schemeHint,
      cardholderName: null,
      source: 'nfc',
      notice,
    });

    if (isPartial) {
      setPartialNotice(notice);
      setPhase('partial');
    } else {
      setPhase('success');
    }
  }, [setCapture]);

  useEffect(() => {
    startReadRef.current = startRead;
  }, [startRead]);

  // Resolve "don't show again", probe NFC for logs only — never surface status in UI.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    (async () => {
      const skip = await getSkipCaptureExplainer('nfc');
      if (cancelled) return;
      skipExplainerRef.current = skip;
      logger.info('[NFC UI] screen mount', { skipExplainer: skip });
      void getNfcStatus().then((status) => {
        logger.info('[NFC UI] preflight status', { status });
      });
      if (skip) {
        void startReadRef.current();
      } else {
        setPhase('explainer');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cancel in-flight NFC if user leaves.
  useEffect(() => {
    return () => {
      reading.current = false;
      readSeq.current += 1;
      // Best-effort cancel — adapter handles missing module.
      import('react-native-nfc-manager')
        .then((m) => m.default.cancelTechnologyRequest())
        .catch(() => undefined);
    };
  }, []);

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Eyebrow color={palette.indigo}>Tap to read</Eyebrow>
          <AppText variant="h2">Tap to read</AppText>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}>
        {phase === 'ios_stub' ? (
          <Stub
            title="Coming soon on iPhone"
            body="Tap to read isn’t available on iPhone yet. Use Scan or Enter manually."
            onScan={goScan}
            onManual={goManual}
          />
        ) : null}

        {phase === 'explainer' ? (
          <View style={styles.explainerWrap}>
            <NfcPermissionExplainer
              onContinue={startRead}
              onCancel={() => router.back()}
            />
          </View>
        ) : null}

        {phase === 'listening' ? (
          <View style={styles.center}>
            <NfcPulseRings />
            <AppText variant="h2" style={styles.centerTitle}>
              Ready to read
            </AppText>
            <AppText variant="body" color={palette.textSecondary} style={styles.centerBody}>
              Hold your card flat against the back of the phone (near the camera). Move
              slowly — don’t tap and pull away.
            </AppText>
            <AppText variant="caption" color={palette.textTertiary} style={styles.centerBody}>
              If nothing happens, briefly turn off Google Pay or Wallet contactless
              payments — they can interrupt card reading.
            </AppText>
            {statusNote ? (
              <AppText variant="small" color={palette.indigo} style={styles.centerBody}>
                {statusNote}
              </AppText>
            ) : (
              <AppText variant="caption" color={palette.textTertiary}>
                Listening for ~25 seconds
              </AppText>
            )}
            <PillButton
              label="Cancel"
              variant="ghost"
              size="md"
              onPress={() => {
                reading.current = false;
                readSeq.current += 1;
                setStatusNote(null);
                logger.info('[NFC UI] Cancel pressed');
                import('react-native-nfc-manager')
                  .then((m) => m.default.cancelTechnologyRequest())
                  .catch(() => undefined);
                if (skipExplainerRef.current) {
                  router.back();
                } else {
                  setPhase('explainer');
                }
              }}
            />
          </View>
        ) : null}

        {phase === 'success' ? (
          <CaptureSuccessBurst
            title="Card read"
            subtitle="Opening the form — number stays masked"
            onDone={finishCaptureToForm}
          />
        ) : null}

        {phase === 'partial' ? (
          <View style={styles.center}>
            <View style={[styles.warnIcon, { backgroundColor: palette.amberSoft }]}>
              <Ionicons name="alert-circle-outline" size={36} color={palette.amber} />
            </View>
            <AppText variant="h2" style={styles.centerTitle}>
              Partial details only
            </AppText>
            <AppText variant="body" color={palette.textSecondary} style={styles.centerBody}>
              {partialNotice}
            </AppText>
            <PillButton
              label="Complete manually"
              icon="create-outline"
              size="lg"
              fullWidth
              onPress={finishCaptureToForm}
            />
          </View>
        ) : null}

        {phase === 'duplicate' ? (
          <View style={styles.center}>
            <View style={[styles.warnIcon, { backgroundColor: palette.amberSoft }]}>
              <Ionicons name="copy-outline" size={36} color={palette.amber} />
            </View>
            <AppText variant="h2" style={styles.centerTitle}>
              Card not added
            </AppText>
            <AppText variant="body" color={palette.textSecondary} style={styles.centerBody}>
              That card is already in your vault, so we didn’t add it again. Read a different
              card, or head back.
            </AppText>
            <View style={styles.actions}>
              <PillButton
                label="Read another card"
                icon="wifi"
                size="lg"
                fullWidth
                onPress={() => {
                  void startRead();
                }}
              />
              <PillButton
                label="Back"
                variant="ghost"
                size="lg"
                fullWidth
                onPress={() => router.back()}
              />
            </View>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={styles.center}>
            <View style={[styles.warnIcon, { backgroundColor: palette.amberSoft }]}>
              <Ionicons name="close-circle-outline" size={36} color={palette.amber} />
            </View>
            <AppText variant="h2" style={styles.centerTitle}>
              Couldn’t read this card
            </AppText>
            <AppText variant="body" color={palette.textSecondary} style={styles.centerBody}>
              {errorMessage ?? "Couldn't read this card — try Scan or Enter manually."}
            </AppText>
            <View style={styles.actions}>
              <PillButton
                label="Try again"
                icon="refresh-outline"
                size="lg"
                fullWidth
                onPress={() => {
                  // Straight back into listening — the explainer is entry-only.
                  void startRead();
                }}
              />
              <PillButton
                label="Scan card"
                icon="scan-outline"
                variant="ghost"
                size="lg"
                fullWidth
                onPress={goScan}
              />
              <PillButton
                label="Enter manually"
                icon="create-outline"
                variant="ghost"
                size="lg"
                fullWidth
                onPress={goManual}
              />
              {errorMessage?.toLowerCase().includes('turned off') ? (
                <PillButton
                  label="Open NFC settings"
                  variant="ghost"
                  size="md"
                  fullWidth
                  onPress={openNfcSettings}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Stub({
  title,
  body,
  onScan,
  onManual,
}: {
  title: string;
  body: string;
  onScan: () => void;
  onManual: () => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.center}>
      <View style={[styles.infoIcon, { backgroundColor: palette.indigoSoft }]}>
        <Ionicons name="phone-portrait-outline" size={36} color={palette.indigo} />
      </View>
      <AppText variant="h2" style={styles.centerTitle}>
        {title}
      </AppText>
      <AppText variant="body" color={palette.textSecondary} style={styles.centerBody}>
        {body}
      </AppText>
      <View style={styles.actions}>
        <PillButton label="Scan card" icon="scan-outline" size="lg" fullWidth onPress={onScan} />
        <PillButton
          label="Enter manually"
          icon="create-outline"
          variant="ghost"
          size="lg"
          fullWidth
          onPress={onManual}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
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
  },
  explainerWrap: {
    width: '100%',
    gap: spacing.sm,
  },
  center: { alignItems: 'center', gap: spacing.md },
  centerTitle: { textAlign: 'center' },
  centerBody: { textAlign: 'center', marginBottom: spacing.sm },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
  warnIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  infoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
