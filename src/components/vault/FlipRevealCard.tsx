/**
 * FlipRevealCard — front (masked) → biometric → spring flip → back.
 *
 * Back face: independent eye toggles for Number and CVV. Only one may be
 * unmasked at a time (toggling one re-masks the other). Session holds both
 * decrypted strings in a ref so toggles do not re-prompt biometrics.
 * Number-only copy via dedicated icon when revealed (CVV is never copyable).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CardFace, type BackActiveField } from './CardFace';
import { CopyToast } from '@/components/ui/CopyToast';
import {
  BiometricRequiredError,
  CryptoUnavailableError,
  KeyStoreUnavailableError,
  decryptFields,
  isUnrecoverableCardError,
} from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { markCardTxnLinkBlocked } from '@/hooks/useTransactions';
import { showDialog } from '@/stores/dialogStore';
import { useQueryClient } from '@tanstack/react-query';
import { cardKeys } from '@/hooks/useCards';
import {
  CLIPBOARD_CLEAR_MS,
  copyPlain,
  copyWithConditionalClear,
} from '@/lib/secureClipboard';
import { digitsOnly } from '@/lib/cardUtils';
import { motion } from '@/theme';
import { useSensitiveStore, AUTO_CLEAR_MS } from '@/stores/sensitiveStore';
import { useAppLockStore } from '@/stores/appLockStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hasStoredCvv, type VaultCard } from '@/types/card';

interface FlipRevealCardProps {
  card: VaultCard;
  onRecoveryNeeded?: () => void;
  /** Opens lightweight name editor — front face only; never gates on biometrics. */
  onEditCardholderName?: () => void;
  /** Opens share flow — front face top-right; never gates on biometrics. */
  onShare?: () => void;
}

type SessionSecrets = { pan: string | null; cvv: string | null };

export function FlipRevealCard({
  card,
  onRecoveryNeeded,
  onEditCardholderName,
  onShare,
}: FlipRevealCardProps) {
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const flip = useSharedValue(0);
  const revealed = useSensitiveStore((s) => s.revealed);
  const reveal = useSensitiveStore((s) => s.reveal);
  const clear = useSensitiveStore((s) => s.clear);
  const clearAll = useSensitiveStore((s) => s.clearAll);
  const setSensitive = useAppLockStore((s) => s.setSensitiveScreenActive);

  const panId = `${card.id}:pan`;
  const cvvId = `${card.id}:cvv`;
  const storesCvv = hasStoredCvv(card);

  const [unlocked, setUnlocked] = useState(false);
  const [activeField, setActiveField] = useState<BackActiveField>('number');
  const skipRevealRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  /** SENSITIVE: decrypted values for this unlock session only — never log. */
  const session = useRef<SessionSecrets>({ pan: null, cvv: null });
  const switching = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardCancel = useRef<(() => void) | null>(null);

  const pan = revealed[panId] ?? null;
  const cvv = revealed[cvvId] ?? null;

  const wipeSession = useCallback(() => {
    session.current = { pan: null, cvv: null };
  }, []);

  const remask = useCallback(() => {
    switching.current = true;
    clear(panId);
    clear(cvvId);
    wipeSession();
    setUnlocked(false);
    setActiveField('number');
    flip.value = withSpring(0, motion.springConfig);
    switching.current = false;
  }, [clear, panId, cvvId, wipeSession, flip]);

  useEffect(() => {
    setSensitive(true);
    return () => {
      setSensitive(false);
      clearAll();
      wipeSession();
      clipboardCancel.current?.();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [setSensitive, clearAll, wipeSession]);

  // Auto-clear of the visible field → remask whole card (session ends).
  useEffect(() => {
    if (!unlocked || switching.current) return;
    const visible = activeField === 'number' ? revealed[panId] : revealed[cvvId];
    if (!visible) {
      remask();
    }
  }, [revealed, panId, cvvId, activeField, unlocked, remask]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
    backfaceVisibility: 'hidden',
    opacity: flip.value > 0.5 ? 0 : 1,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: flip.value > 0.5 ? 1 : 0,
  }));

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const publishVisible = useCallback(
    (field: BackActiveField) => {
      if (field === activeField) return;
      const nextValue = field === 'number' ? session.current.pan : session.current.cvv;
      // After a number copy we wipe CVV from session — toggling to it needs a new flip.
      if (!nextValue) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        remask();
        return;
      }
      switching.current = true;
      // Re-mask the other field immediately (remove from sensitive store).
      // reveal() resets the 10s auto-clear timer for the newly shown field.
      if (field === 'number') {
        clear(cvvId);
        reveal(panId, nextValue);
      } else {
        clear(panId);
        reveal(cvvId, nextValue);
      }
      setActiveField(field);
      requestAnimationFrame(() => {
        switching.current = false;
      });
    },
    [activeField, clear, reveal, panId, cvvId, remask],
  );

  const onReveal = useCallback(async () => {
    if (unlocked) {
      remask();
      return;
    }

    try {
      const fields: Record<string, { ciphertext: string; iv: string; authTag: string }> = {
        pan: {
          ciphertext: card.cardNumberEncrypted,
          iv: card.cardNumberIv,
          authTag: card.cardNumberAuthTag,
        },
      };
      if (storesCvv) {
        fields.cvv = {
          ciphertext: card.cvvEncrypted!,
          iv: card.cvvIv!,
          authTag: card.cvvAuthTag!,
        };
      }

      const plain = await decryptFields(fields, 'Reveal card details');
      // SENSITIVE: hold in session ref + show Number only — never log.
      session.current = {
        pan: plain.pan,
        cvv: plain.cvv ?? null,
      };
      switching.current = true;
      clear(cvvId);
      reveal(panId, plain.pan);
      setActiveField('number');
      setUnlocked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flip.value = reduced
        ? withSpring(1, { damping: 20, stiffness: 220 })
        : withSpring(1, motion.springConfig);
      requestAnimationFrame(() => {
        switching.current = false;
      });
    } catch (err) {
      logger.warn('Card reveal cancelled or failed', err);

      // Cancelled or failed prompt — the user already knows, stay silent.
      if (err instanceof BiometricRequiredError) return;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (err instanceof KeyStoreUnavailableError) {
        showDialog({
          title: 'Couldn’t reach secure storage',
          message:
            'Your device’s keychain was busy. Nothing is wrong with this card — tap to reveal again in a moment.',
          icon: 'refresh-outline',
          tone: 'amber',
          actions: [{ label: 'Got it', variant: 'primary' }],
        });
        return;
      }

      if (err instanceof CryptoUnavailableError) {
        showDialog({
          title: 'Can’t unlock card numbers',
          message:
            'This version of KeyKards can’t unlock saved card numbers. Please update or reinstall the app, then try again.',
          icon: 'construct-outline',
          tone: 'amber',
          actions: [{ label: 'Got it', variant: 'primary' }],
        });
        return;
      }

      if (isUnrecoverableCardError(err)) {
        // Mark locally first so txn-link flows know immediately; network write
        // is best-effort and must not affect Vault viewing or reveal.
        const patchBlocked = (c: VaultCard): VaultCard =>
          c.id === card.id ? { ...c, txnLinkBlocked: true } : c;
        qc.setQueryData<VaultCard>(cardKeys.detail(card.id), (prev) =>
          prev ? patchBlocked(prev) : { ...card, txnLinkBlocked: true },
        );
        qc.setQueriesData<VaultCard[]>(
          { queryKey: ['cards', 'list'] },
          (prev) => (prev ? prev.map(patchBlocked) : prev),
        );
        void markCardTxnLinkBlocked(card.id).then(() => {
          qc.invalidateQueries({ queryKey: cardKeys.all });
          qc.invalidateQueries({ queryKey: cardKeys.detail(card.id) });
        });
        showDialog({
          title: 'Re-enter this card once',
          message:
            'This card was saved with an encryption key that is no longer on this device, so its number can’t be unlocked. Re-enter the card number in Edit card to secure it with the current key. You can still view the card — only linking new transactions is paused until then.',
          icon: 'key-outline',
          tone: 'amber',
          actions: [
            { label: 'Not now', variant: 'ghost' },
            ...(onRecoveryNeeded
              ? [
                  {
                    label: 'Edit card',
                    variant: 'primary' as const,
                    onPress: onRecoveryNeeded,
                  },
                ]
              : []),
          ],
        });
        return;
      }

      showDialog({
        title: 'Couldn’t reveal card',
        message: 'Something went wrong unlocking this card. Please try again.',
        icon: 'alert-circle-outline',
        tone: 'amber',
        actions: [{ label: 'Got it', variant: 'primary' }],
      });
    }
  }, [
    unlocked,
    remask,
    card,
    storesCvv,
    clear,
    cvvId,
    reveal,
    panId,
    flip,
    reduced,
    qc,
  ]);

  /** Number-only — CVV is never copyable. */
  const onCopyNumber = useCallback(async () => {
    const value = session.current.pan ? digitsOnly(session.current.pan) : null;
    const visible = activeField === 'number' && Boolean(revealed[panId]);
    if (!value || !visible) return;

    try {
      clipboardCancel.current?.();
      const handle = await copyWithConditionalClear(value, CLIPBOARD_CLEAR_MS);
      clipboardCancel.current = handle.cancel;
      // Drop CVV from session after number copy (still requires re-flip to see CVV).
      session.current.cvv = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Copied — clears in 30s');
    } catch (err) {
      logger.warn('Sensitive copy failed', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [activeField, revealed, panId]);

  const onCopyConvenience = useCallback(
    async (kind: 'last4' | 'expiry' | 'bank', value: string) => {
      if (!value.trim()) return;
      try {
        await copyPlain(value.trim());
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showToast(
          kind === 'last4'
            ? 'Last 4 copied'
            : kind === 'expiry'
              ? 'Expiry copied'
              : 'Bank copied',
        );
      } catch (err) {
        logger.warn('Convenience copy failed', err);
      }
    },
    [],
  );

  return (
    <View style={styles.wrap}>
      <Animated.View style={frontStyle}>
        <Pressable
          onPress={() => {
            // Child "Add name" Pressable owns that hit target; if both fire on a
            // platform quirk, ignore reveal for a tick after name edit opens.
            if (skipRevealRef.current) return;
            onReveal();
          }}
          accessibilityRole="button"
          accessibilityLabel="Tap to reveal card"
        >
          <CardFace
            nickname={card.nickname}
            bankName={card.bankName}
            network={card.network}
            lastFour={card.lastFour}
            themeId={card.cardColorTheme}
            expiryMonth={card.expiryMonth}
            expiryYear={card.expiryYear}
            cardholderName={card.cardholderName}
            onCardholderPress={
              onEditCardholderName
                ? () => {
                    skipRevealRef.current = true;
                    onEditCardholderName();
                    requestAnimationFrame(() => {
                      skipRevealRef.current = false;
                    });
                  }
                : undefined
            }
            topRightSlot={
              onShare ? (
                <Pressable
                  onPress={() => {
                    skipRevealRef.current = true;
                    onShare();
                    requestAnimationFrame(() => {
                      skipRevealRef.current = false;
                    });
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Share this card"
                  style={styles.shareBtn}
                >
                  <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                </Pressable>
              ) : undefined
            }
          />
        </Pressable>
      </Animated.View>

      <Animated.View style={backStyle} pointerEvents={unlocked ? 'auto' : 'none'}>
        <CardFace
          variant="back"
          nickname={card.nickname}
          bankName={card.bankName}
          network={card.network}
          lastFour={card.lastFour}
          themeId={card.cardColorTheme}
          expiryMonth={card.expiryMonth}
          expiryYear={card.expiryYear}
          activeField={activeField}
          onActiveFieldChange={publishVisible}
          hasCvv={storesCvv}
          revealedNumber={activeField === 'number' ? pan : null}
          revealedCvv={activeField === 'cvv' ? cvv : null}
          onCopyNumber={onCopyNumber}
          onCopyConvenience={onCopyConvenience}
          hint={`Hides in ${Math.round(AUTO_CLEAR_MS / 1000)}s · tap to hide`}
          onHintPress={remask}
        />
      </Animated.View>

      <CopyToast message={toast} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
});
