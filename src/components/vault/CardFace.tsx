/**
 * CardFace — credit-card visual (chip, contactless, masked/full number, network).
 * Used as list preview and as flip-card front/back faces.
 *
 * Back face: Number and CVV each have an eye toggle; only one may be unmasked
 * at a time. Copy is number-only via a dedicated icon when revealed.
 *
 * BADGE LAYOUT: indicators must NOT be absolutely positioned over this face by
 * callers — that is what made the sync badge collide with the network mark.
 * Pass them via `statusSlot` (rendered in ZONE_STATUS, beneath the nickname).
 * See components/vault/cardBadgeZones.tsx for the full zone map and rules.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui/AppText';
import { NetworkBadge } from '@/components/vault/NetworkBadge';
import { CardMaterialOverlay } from '@/components/vault/CardMaterialOverlay';
import { getCardTheme } from '@/lib/cardThemes';
import { formatCardNumberGroups, formatExpiry, maskCardNumber } from '@/lib/cardUtils';
import { palette, radius, spacing, motion } from '@/theme';
import { useCardCanvasElevation } from '@/hooks/useCardCanvasElevation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hasDisplayableCardholderName } from '@/lib/cardholderName';
import type { CardColorTheme, CardNetwork } from '@/types/card';

export type BackActiveField = 'number' | 'cvv';

export interface CardFaceProps {
  nickname: string;
  bankName: string;
  network: CardNetwork;
  lastFour: string;
  themeId: CardColorTheme;
  expiryMonth?: number;
  expiryYear?: number;
  /** When set AND activeField==='number', shows full PAN (SENSITIVE). */
  revealedNumber?: string | null;
  /** When set AND activeField==='cvv', shows CVV (SENSITIVE). */
  revealedCvv?: string | null;
  /** Which sensitive field is unmasked on the back (null = both masked). */
  activeField?: BackActiveField | null;
  onActiveFieldChange?: (field: BackActiveField) => void;
  /** True when this card stores a CVV (enables CVV eye). */
  hasCvv?: boolean;
  /** Copy full number — only wired when number is revealed. */
  onCopyNumber?: () => void;
  /** Tap last-4 / expiry / bank for convenience copy. */
  onCopyConvenience?: (kind: 'last4' | 'expiry' | 'bank', value: string) => void;
  variant?: 'front' | 'back' | 'mini' | 'compact';
  hint?: string;
  onHintPress?: () => void;
  /**
   * ZONE_STATUS content (sync state, warnings). Rendered in normal flow under
   * the nickname so it can never overlap the network mark. Never position
   * status indicators absolutely over the card.
   */
  statusSlot?: React.ReactNode;
  /**
   * ZONE_TOP_RIGHT — e.g. Share on card detail front. On dense variants the
   * network badge still owns this corner unless you pass a slot.
   */
  topRightSlot?: React.ReactNode;
  /** Printed name on card — front face only; omit when null. */
  cardholderName?: string | null;
  /**
   * When set, tapping the name (or the empty name zone) opens edit.
   * Unset + no callback → nothing rendered (no reserved gap).
   */
  onCardholderPress?: () => void;
  /**
   * When false, skip drop shadow (parent owns elevation — e.g. Spotlight clip
   * wrapper). Default true.
   */
  elevate?: boolean;
  style?: ViewStyle;
}

function EyeToggle({
  revealed,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  revealed: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withSpring(1.22, { damping: 12, stiffness: 320, mass: 0.6 }),
      withSpring(1, motion.springConfig),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, reduced]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), checked: revealed }}
      style={[styles.iconBtn, disabled && styles.iconBtnDisabled]}
    >
      <Animated.View style={animStyle}>
        <Ionicons
          name={revealed ? 'eye-outline' : 'eye-off-outline'}
          size={16}
          color={
            disabled
              ? 'rgba(255,255,255,0.3)'
              : revealed
                ? palette.white
                : 'rgba(255,255,255,0.75)'
          }
        />
      </Animated.View>
    </Pressable>
  );
}

export function CardFace({
  nickname,
  bankName,
  network,
  lastFour,
  themeId,
  expiryMonth,
  expiryYear,
  revealedNumber,
  revealedCvv,
  activeField = 'number',
  onActiveFieldChange,
  hasCvv = true,
  onCopyNumber,
  onCopyConvenience,
  variant = 'front',
  hint,
  onHintPress,
  statusSlot,
  topRightSlot,
  cardholderName,
  onCardholderPress,
  elevate = true,
  style,
}: CardFaceProps) {
  const theme = getCardTheme(themeId);
  const canvasElevation = useCardCanvasElevation();
  const isMini = variant === 'mini';
  const isCompact = variant === 'compact';
  const isBack = variant === 'back';
  const dense = isMini || isCompact;
  const holderVisible = hasDisplayableCardholderName(cardholderName);
  /** Exclude mini/compact — no room for printed name at those densities. */
  const showHolderSlot =
    !isBack && !dense && (holderVisible || Boolean(onCardholderPress));

  const showingNumber = isBack
    ? activeField === 'number' && Boolean(revealedNumber)
    : Boolean(revealedNumber);
  const numberText =
    showingNumber && revealedNumber
      ? formatCardNumberGroups(revealedNumber)
      : maskCardNumber(lastFour);

  const showingCvv = isBack && activeField === 'cvv' && Boolean(revealedCvv);
  const cvvText = showingCvv ? (revealedCvv ?? '—') : '•••';

  const selectField = (field: BackActiveField) => {
    if (field === 'cvv' && !hasCvv) return;
    // Tapping the already-visible eye keeps it revealed (timer already running).
    // Parent still no-ops same-field publishes.
    Haptics.selectionAsync();
    onActiveFieldChange?.(field);
  };

  const gradient = (
    <LinearGradient
      colors={[...theme.colors]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        isBack && styles.cardBack,
        isMini && styles.mini,
        isCompact && styles.compact,
        !elevate ? style : styles.cardFill,
      ]}
    >
      <CardMaterialOverlay />
      {/* ZONE_TOP_LEFT (bank/nickname + ZONE_STATUS) | ZONE_TOP_RIGHT */}
      <View style={[styles.topRow, isBack && styles.topRowBack]}>
        <View style={styles.topLeft}>
          <Pressable
            disabled={!onCopyConvenience}
            onPress={() => onCopyConvenience?.('bank', bankName)}
            accessibilityRole={onCopyConvenience ? 'button' : undefined}
            accessibilityLabel={onCopyConvenience ? `Copy bank ${bankName}` : undefined}
          >
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.7)"
              style={styles.bank}
              numberOfLines={1}
            >
              {bankName || 'Bank'}
            </AppText>
            {!isCompact ? (
              <AppText
                variant={isMini || isBack ? 'small' : 'title'}
                color={palette.white}
                numberOfLines={1}
              >
                {nickname}
              </AppText>
            ) : (
              <AppText variant="small" color={palette.white} numberOfLines={1}>
                {nickname}
              </AppText>
            )}
          </Pressable>
          {statusSlot ? <View style={styles.statusZone}>{statusSlot}</View> : null}
        </View>
        {topRightSlot ? (
          <View style={styles.topRight}>{topRightSlot}</View>
        ) : dense ? (
          <NetworkBadge network={network} size="sm" contrast="onDark" />
        ) : null}
      </View>

      {!isBack && !isCompact ? (
        <View style={styles.midRow}>
          <View style={[styles.chip, dense && styles.chipMini]} />
          <Ionicons
            name="wifi"
            size={dense ? 16 : 22}
            color="rgba(255,255,255,0.85)"
            style={styles.contactless}
          />
        </View>
      ) : null}

      {isBack ? (
        <>
          <View style={styles.magstripe} />

          <View style={styles.numberRow}>
            <AppText
              variant="small"
              color={palette.white}
              style={styles.number}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {numberText}
            </AppText>
            <View style={styles.fieldActions}>
              <EyeToggle
                revealed={showingNumber}
                onPress={() => selectField('number')}
                accessibilityLabel={
                  showingNumber ? 'Hide card number' : 'Show card number'
                }
              />
              {showingNumber && onCopyNumber ? (
                <Pressable
                  onPress={onCopyNumber}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Copy card number"
                  style={styles.iconBtn}
                >
                  <Ionicons name="copy-outline" size={15} color={palette.white} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sigStrip}>
            <View style={styles.sigPanel}>
              <View style={styles.cvvCluster}>
                <AppText variant="caption" color="rgba(255,255,255,0.7)">
                  CVV
                </AppText>
                <AppText variant="small" color={palette.white} style={styles.cvvValue}>
                  {cvvText}
                </AppText>
                <EyeToggle
                  revealed={showingCvv}
                  onPress={() => selectField('cvv')}
                  disabled={!hasCvv}
                  accessibilityLabel={
                    !hasCvv
                      ? 'CVV not stored'
                      : showingCvv
                        ? 'Hide CVV'
                        : 'Show CVV'
                  }
                />
              </View>
              {expiryMonth != null && expiryYear != null ? (
                <Pressable
                  disabled={!onCopyConvenience}
                  onPress={() =>
                    onCopyConvenience?.(
                      'expiry',
                      formatExpiry(expiryMonth, expiryYear),
                    )
                  }
                  accessibilityRole={onCopyConvenience ? 'button' : undefined}
                  accessibilityLabel="Copy expiry"
                  style={styles.expBack}
                >
                  <AppText variant="caption" color="rgba(255,255,255,0.75)">
                    EXP {formatExpiry(expiryMonth, expiryYear)}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>

          {hint ? (
            <Pressable
              onPress={onHintPress}
              disabled={!onHintPress}
              accessibilityRole={onHintPress ? 'button' : undefined}
              style={styles.backHint}
            >
              <AppText variant="caption" color="rgba(255,255,255,0.8)" numberOfLines={1}>
                {hint}
              </AppText>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <AppText
            variant={isCompact ? 'caption' : dense ? 'small' : 'bodyLg'}
            color={palette.white}
            style={[styles.number, styles.embossed]}
          >
            {numberText}
          </AppText>

          {showHolderSlot ? (
            <Pressable
              onPress={onCardholderPress}
              disabled={!onCardholderPress}
              accessibilityRole={onCardholderPress ? 'button' : undefined}
              accessibilityLabel={
                holderVisible
                  ? onCardholderPress
                    ? `Name on card ${cardholderName}. Tap to edit`
                    : `Name on card ${cardholderName}`
                  : 'Add name on card'
              }
              style={styles.holderPress}
              hitSlop={onCardholderPress && !holderVisible ? 8 : undefined}
            >
              {holderVisible ? (
                <AppText
                  variant={dense ? 'caption' : 'small'}
                  color={palette.white}
                  style={[styles.holderName, styles.embossed]}
                  numberOfLines={1}
                >
                  {cardholderName!.trim()}
                </AppText>
              ) : (
                <AppText
                  variant="caption"
                  color="rgba(255,255,255,0.45)"
                  style={styles.holderCta}
                >
                  ADD NAME
                </AppText>
              )}
            </Pressable>
          ) : null}

          <View style={styles.bottomRow}>
            {expiryMonth != null && expiryYear != null ? (
              <AppText variant="caption" color="rgba(255,255,255,0.75)">
                EXP  {formatExpiry(expiryMonth, expiryYear)}
              </AppText>
            ) : onCopyConvenience ? (
              <Pressable
                onPress={() => onCopyConvenience('last4', lastFour)}
                accessibilityRole="button"
                accessibilityLabel="Copy last four"
              >
                <AppText variant="caption" color="rgba(255,255,255,0.75)">
                  •••• {lastFour}
                </AppText>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.bottomRight}>
              {hint ? (
                <Pressable
                  onPress={onHintPress}
                  disabled={!onHintPress}
                  accessibilityRole={onHintPress ? 'button' : undefined}
                >
                  <AppText variant="caption" color="rgba(255,255,255,0.85)">
                    {hint}
                  </AppText>
                </Pressable>
              ) : null}
              {!dense ? (
                <NetworkBadge network={network} size="md" contrast="onDark" />
              ) : null}
            </View>
          </View>
        </>
      )}
    </LinearGradient>
  );

  if (!elevate) return gradient;

  // Elevation on a separate opaque plate — never on the overflow:hidden face
  // (Android draws a rectangular silhouette when those are combined).
  const corner =
    isMini || isCompact ? radius.lg : radius.xl;

  return (
    <View
      style={[
        styles.elevatePlate,
        {
          borderRadius: corner,
          backgroundColor: theme.colors[0],
        },
        canvasElevation,
        style,
      ]}
    >
      {gradient}
    </View>
  );
}

const styles = StyleSheet.create({
  elevatePlate: {
    width: '100%',
  },
  cardFill: {
    width: '100%',
  },
  card: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  /** Tighter vertical budget so back-face content fits the fixed aspect box. */
  cardBack: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  mini: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  compact: {
    aspectRatio: 1.7,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  topLeft: { flex: 1, minWidth: 0, flexShrink: 1 },
  topRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  /** ZONE_STATUS — wraps so multiple indicators never stack on each other. */
  statusZone: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flexShrink: 0,
  },
  topRowBack: {
    marginBottom: 0,
  },
  bank: { textTransform: 'uppercase', letterSpacing: 1, marginBottom: 1 },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  chip: {
    width: 42,
    height: 30,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 198, 90, 0.85)',
  },
  chipMini: { width: 28, height: 20, borderRadius: 4 },
  contactless: { transform: [{ rotate: '90deg' }] },
  magstripe: {
    height: 28,
    marginHorizontal: -spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexShrink: 0,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    minHeight: 28,
  },
  number: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  /** Raised/printed look shared by PAN + cardholder name. */
  embossed: {
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  holderPress: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    marginTop: 2,
    marginBottom: 2,
  },
  holderName: {
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  holderCta: {
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  fieldActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  iconBtnDisabled: {
    opacity: 0.45,
  },
  sigStrip: {
    flexShrink: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sigPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cvvCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  cvvValue: {
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  expBack: { flexShrink: 0 },
  backHint: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: 'auto',
  },
});
