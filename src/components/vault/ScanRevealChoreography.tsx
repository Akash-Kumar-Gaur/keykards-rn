/**
 * ScanRevealChoreography — success reveal for the camera card scan.
 *
 * Plays over the still-mounted preview so the camera surface is never torn
 * down mid-transition (tearing it down is what caused the black flash), in
 * four beats:
 *   1. detect  — outline the text the recognizer actually read, staggered
 *   2. travel  — those labels fly to where they sit on a real card
 *   3. settle  — the card materialises inside the scan frame beneath them
 *   4. handoff — onDone() fires with the card still resting in the frame, so the
 *                root CardMorphOverlay can pick it up from exactly there and
 *                carry it across the route change into the form's preview
 *
 * Beat 4 deliberately does NOT animate the card away: the whole point is that
 * the card the user sees here is the same card that lands on the next screen.
 *
 * Labels only ever show what OCR read (PAN masked to last four, matching the
 * vault's default). Nothing is estimated or invented.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { NetworkBadge } from '@/components/vault/NetworkBadge';
import { CardMaterialOverlay } from '@/components/vault/CardMaterialOverlay';
import type { ScanFrameRect } from '@/components/vault/CardScanOverlay';
import { getCardTheme } from '@/lib/cardThemes';
import { formatExpiry, lastFourFromNumber, maskCardNumber } from '@/lib/cardUtils';
import type { Box, OcrFieldKind, OcrFieldRegion } from '@/lib/cardOcrRegions';
import { fontFamily, palette, radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CardNetwork } from '@/types/card';

const DETECT_IN = 260;
const STAGGER = 90;
const HOLD = 200;
const TRAVEL = 620;
const SETTLE = 260;
/**
 * Detect-beat length when nothing could be located on the preview. A sweep over
 * the frame claims only "the card was read", never *where* a field sits, so the
 * reveal keeps its rhythm without implying a position we don't have.
 */
const SWEEP = 540;

/**
 * Where each field is printed on the card, as a fraction of the frame. The card
 * mock positions its text at these exact slots so a travelling label lands
 * pixel-aligned with its final resting place.
 */
const SLOTS: Record<OcrFieldKind, Box> = {
  pan: { x: 0.075, y: 0.5, width: 0.85, height: 0.15 },
  name: { x: 0.075, y: 0.695, width: 0.62, height: 0.11 },
  expiry: { x: 0.075, y: 0.84, width: 0.34, height: 0.1 },
};

export type ScanRevealCard = {
  panDigits: string;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardholderName: string | null;
  networkHint: CardNetwork | null;
};

type Field = {
  kind: OcrFieldKind;
  label: string;
  /** Screen rect the label ends at. */
  target: Box;
  /** Screen rect OCR found it at, or null when it couldn't be located. */
  start: Box | null;
  fontSize: number;
};

function slotToScreen(slot: Box, frame: ScanFrameRect): Box {
  return {
    x: frame.x + slot.x * frame.width,
    y: frame.y + slot.y * frame.height,
    width: slot.width * frame.width,
    height: slot.height * frame.height,
  };
}

function buildFields(
  card: ScanRevealCard,
  regions: OcrFieldRegion[],
  frame: ScanFrameRect,
): Field[] {
  const regionFor = (kind: OcrFieldKind) =>
    regions.find((r) => r.kind === kind)?.box ?? null;

  const fields: Field[] = [];

  fields.push({
    kind: 'pan',
    // Masked on purpose — the vault never prints a full PAN by default.
    label: maskCardNumber(lastFourFromNumber(card.panDigits)),
    target: slotToScreen(SLOTS.pan, frame),
    start: regionFor('pan'),
    fontSize: frame.width * 0.062,
  });

  if (card.cardholderName) {
    fields.push({
      kind: 'name',
      label: card.cardholderName.trim().toUpperCase(),
      target: slotToScreen(SLOTS.name, frame),
      start: regionFor('name'),
      fontSize: frame.width * 0.042,
    });
  }

  if (card.expiryMonth != null && card.expiryYear != null) {
    fields.push({
      kind: 'expiry',
      label: formatExpiry(card.expiryMonth, card.expiryYear),
      target: slotToScreen(SLOTS.expiry, frame),
      start: regionFor('expiry'),
      fontSize: frame.width * 0.038,
    });
  }

  return fields;
}

export function ScanRevealChoreography({
  frame,
  regions,
  card,
  onDone,
}: {
  frame: ScanFrameRect;
  regions: OcrFieldRegion[];
  card: ScanRevealCard;
  onDone: () => void;
}) {
  const activePalette = usePalette();
  const reduced = useReducedMotion();
  const theme = getCardTheme(null);

  const fields = useMemo(
    () => buildFields(card, regions, frame),
    [card, regions, frame],
  );

  const scrim = useSharedValue(0);
  const travel = useSharedValue(0);
  const cardIn = useSharedValue(0);
  const chrome = useSharedValue(0);
  const sweep = useSharedValue(0);

  // Fixed pool so hook order never depends on how many fields were located.
  const d0 = useSharedValue(0);
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const detects = useMemo(() => [d0, d1, d2], [d0, d1, d2]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (reduced) {
      scrim.value = 1;
      travel.value = 1;
      cardIn.value = 1;
      chrome.value = 1;
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }

    const located = fields.filter((f) => f.start);
    // No usable positions — sweep the frame instead of skipping straight to a
    // finished card, which read as the detect beat never happening.
    const detectWindow =
      located.length > 0 ? located.length * STAGGER + DETECT_IN : SWEEP;
    const travelStart = detectWindow + HOLD;

    scrim.value = withTiming(1, { duration: 220 });

    if (located.length === 0) {
      sweep.value = withTiming(1, {
        duration: SWEEP,
        easing: Easing.inOut(Easing.quad),
      });
    }

    located.forEach((_, i) => {
      const shared = detects[i];
      if (!shared) return;
      const inDone = i * STAGGER + DETECT_IN;
      shared.value = withSequence(
        withDelay(i * STAGGER, withTiming(1, { duration: DETECT_IN })),
        withDelay(
          Math.max(travelStart - inDone, 0),
          withTiming(0, { duration: 200 }),
        ),
      );
    });

    travel.value = withDelay(
      travelStart,
      withTiming(1, { duration: TRAVEL, easing: Easing.out(Easing.cubic) }),
    );
    cardIn.value = withDelay(travelStart + 80, withTiming(1, { duration: 420 }));
    chrome.value = withDelay(
      travelStart + TRAVEL - 120,
      withTiming(1, { duration: 300 }),
    );
    // Hand the card over while it is still sitting in the frame.
    const t = setTimeout(onDone, travelStart + TRAVEL + SETTLE);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, fields]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * scrim.value + 0.5 * cardIn.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardIn.value,
    transform: [{ scale: 0.96 + 0.04 * cardIn.value }],
  }));

  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  // Fades in and out across the pass so it reads as a sweep, not a wipe.
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: Math.sin(Math.PI * sweep.value) * (1 - cardIn.value),
    transform: [{ translateY: sweep.value * frame.height }],
  }));

  const located = fields.filter((f) => f.start);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
      />

      {/* Beat 1 — outline what the recognizer read, in place on the preview. */}
      {located.map((field, i) => (
        <DetectOutline
          key={`detect-${field.kind}`}
          box={field.start!}
          progress={detects[i]!}
          color={activePalette.indigo}
        />
      ))}

      {/* Beat 1, fallback — read confirmed but not locatable on the preview. */}
      {located.length === 0 ? (
        <Animated.View
          style={[
            styles.sweep,
            {
              left: frame.x,
              top: frame.y,
              width: frame.width,
              backgroundColor: activePalette.indigo,
            },
            sweepStyle,
          ]}
        />
      ) : null}

      {/* Beat 3 — the card materialises in the frame the user was aiming at. */}
      <Animated.View
        style={[
          styles.cardWrap,
          {
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          },
          cardStyle,
        ]}
      >
        <LinearGradient
          colors={[...theme.colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardFace}
        >
          <CardMaterialOverlay />
        </LinearGradient>

        <Animated.View style={[styles.cardChrome, chromeStyle]}>
          <View style={styles.chip} />
          <Ionicons
            name="wifi"
            size={frame.width * 0.062}
            color="rgba(255,255,255,0.85)"
            style={styles.contactless}
          />
        </Animated.View>

        {card.networkHint ? (
          <Animated.View style={[styles.networkMark, chromeStyle]}>
            <NetworkBadge network={card.networkHint} size="md" contrast="onDark" />
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Beat 2 — the read text flies from the preview onto the card. */}
      {fields.map((field) => (
        <TravelLabel
          key={`travel-${field.kind}`}
          field={field}
          travel={travel}
          cardIn={cardIn}
        />
      ))}

      {card.expiryMonth != null && card.expiryYear != null ? (
        <Animated.View
          style={[
            styles.expCaption,
            {
              left: frame.x + SLOTS.expiry.x * frame.width,
              top: frame.y + (SLOTS.expiry.y - 0.075) * frame.height,
            },
            chromeStyle,
          ]}
        >
          <AppText variant="caption" color="rgba(255,255,255,0.6)" style={styles.expLabel}>
            EXP
          </AppText>
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.caption,
          { top: frame.y + frame.height + spacing.xxl },
          chromeStyle,
        ]}
      >
        <AppText variant="title" color={palette.white} style={styles.captionText}>
          Card read
        </AppText>
        <AppText
          variant="small"
          color="rgba(255,255,255,0.7)"
          style={styles.captionText}
        >
          Review the details — they stay masked until you reveal
        </AppText>
      </Animated.View>
    </View>
  );
}

function DetectOutline({
  box,
  progress,
  color,
}: {
  box: Box;
  progress: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.94 + 0.06 * progress.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.detect,
        {
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

function TravelLabel({
  field,
  travel,
  cardIn,
}: {
  field: Field;
  travel: SharedValue<number>;
  cardIn: SharedValue<number>;
}) {
  const { target, start } = field;

  const style = useAnimatedStyle(() => {
    // Never located on the preview — just fade in with the card.
    if (!start) {
      return { opacity: cardIn.value, transform: [{ scale: 1 }] };
    }
    const p = travel.value;
    const dx =
      start.x + start.width / 2 - (target.x + target.width / 2);
    const dy =
      start.y + start.height / 2 - (target.y + target.height / 2);
    const scale = target.height > 0 ? start.height / target.height : 1;
    return {
      opacity: Math.min(1, p * 4),
      transform: [
        { translateX: (1 - p) * dx },
        { translateY: (1 - p) * dy },
        { scale: 1 + (1 - p) * (scale - 1) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.travel,
        {
          left: target.x,
          top: target.y,
          width: target.width,
          height: target.height,
        },
        style,
      ]}
    >
      <AppText
        color={palette.white}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[
          styles.travelText,
          field.kind === 'pan' && styles.panText,
          field.kind === 'name' && styles.nameText,
          { fontSize: field.fontSize },
        ]}
      >
        {field.label}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#04060F' },
  detect: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
  },
  sweep: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
  },
  cardWrap: { position: 'absolute' },
  cardFace: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  cardChrome: {
    position: 'absolute',
    left: '7.5%',
    top: '17%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  chip: {
    width: 38,
    height: 27,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 198, 90, 0.85)',
  },
  contactless: { transform: [{ rotate: '90deg' }] },
  networkMark: { position: 'absolute', right: '7%', bottom: '8%' },
  travel: {
    position: 'absolute',
    justifyContent: 'center',
  },
  travelText: {
    fontFamily: fontFamily.medium,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  panText: { letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  nameText: { letterSpacing: 1.4 },
  expCaption: { position: 'absolute' },
  expLabel: { letterSpacing: 1.2 },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  captionText: { textAlign: 'center' },
});
