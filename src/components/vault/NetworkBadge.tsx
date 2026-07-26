/**
 * NetworkBadge — compact payment-network mark (SVG asset or monogram fallback).
 * Soft under-tint is for on-dark card faces only.
 *
 * Selection chrome ownership:
 * - Default / standalone: `selected` draws an outline ring outside the fixed box
 *   (admin network chips, etc.) so row height stays stable.
 * - Inside a picker that already has option borders (`bare`): render logo only —
 *   never a ring — so outer + inner wrappers don't stack.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { AppText } from '@/components/ui/AppText';
import { NETWORK_NEEDS_BACKDROP, NETWORK_SVG } from '@/components/vault/networkMarks';
import { NETWORK_BADGE_SIZE } from '@/lib/badgeZones';
import { usePalette } from '@/providers/AppThemeProvider';
import type { CardNetwork } from '@/types/card';

export type NetworkBadgeSize = 'sm' | 'md';
export type NetworkBadgeContrast = 'default' | 'onDark';

export interface NetworkBadgeProps {
  network: CardNetwork;
  size?: NetworkBadgeSize;
  /** Kept for API compat. */
  contrast?: NetworkBadgeContrast;
  inverted?: boolean;
  /**
   * Outline selection without changing layout size.
   * Ignored when `bare` — parent owns selected-state chrome.
   */
  selected?: boolean;
  /**
   * Logo/mark only: no selection ring or extra chrome.
   * Use inside pickers/chips that already draw their own option border.
   */
  bare?: boolean;
  style?: ViewStyle;
}

/** Shared with lib/badgeZones.ts so zone geometry can't drift from the mark. */
const SIZE = NETWORK_BADGE_SIZE;

/** Ring drawn outside the fixed box — must not affect measured height. */
const RING = 2;

const MONOGRAM: Record<CardNetwork, string> = {
  Visa: 'V',
  Mastercard: 'MC',
  RuPay: 'R',
  Amex: 'AX',
  Diners: 'DC',
};

const A11Y: Record<CardNetwork, string> = {
  Visa: 'Visa',
  Mastercard: 'Mastercard',
  RuPay: 'RuPay',
  Amex: 'American Express',
  Diners: 'Diners Club',
};

export function networkAccessibilityLabel(network: CardNetwork): string {
  return A11Y[network] ?? network;
}

export function NetworkBadge({
  network,
  size = 'sm',
  contrast = 'default',
  inverted = false,
  selected = false,
  bare = false,
  style,
}: NetworkBadgeProps) {
  const palette = usePalette();
  const dims = SIZE[size];
  const xml = NETWORK_SVG[network];
  const backdrop = NETWORK_NEEDS_BACKDROP[network];
  const label = networkAccessibilityLabel(network);
  // Dark under-tint only on metallic card faces — on form chrome it reads as
  // an extra circle around every logo.
  const showUnderTone = !bare && (contrast === 'onDark' || inverted);
  const showSelectionRing = !bare && selected;

  const uniqueXml = useMemo(() => {
    if (!xml) return null;
    const uid = `nb_${network}_${size}`;
    return xml
      .replace(/id="([^"]+)"/g, `id="${uid}_$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${uid}_$1)`);
  }, [xml, network, size]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        {
          width: dims.w,
          height: dims.h,
        },
        style,
      ]}
    >
      {showSelectionRing ? (
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: -RING,
              left: -RING,
              right: -RING,
              bottom: -RING,
              borderRadius: dims.radius + RING,
              borderColor: palette.indigo,
            },
          ]}
        />
      ) : null}

      {showUnderTone ? (
        <View
          pointerEvents="none"
          style={[
            styles.underTone,
            {
              width: dims.w,
              height: dims.h,
              borderRadius: dims.radius,
              top: 1.5,
            },
          ]}
        />
      ) : null}

      <View
        style={[
          styles.clip,
          {
            width: dims.w,
            height: dims.h,
            borderRadius: dims.radius,
          },
          !uniqueXml && styles.mono,
          !uniqueXml && { backgroundColor: palette.glassFill },
        ]}
      >
        {backdrop ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: backdrop }]}
          />
        ) : null}
        {uniqueXml ? (
          <SvgXml
            xml={uniqueXml}
            width={dims.w}
            height={dims.h}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <AppText
            variant="caption"
            color={inverted || showSelectionRing ? palette.textOnAccent : palette.textSecondary}
            style={[styles.monoLetter, { fontSize: dims.font }]}
          >
            {MONOGRAM[network] ?? '?'}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  underTone: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  ring: {
    position: 'absolute',
    borderWidth: RING,
    backgroundColor: 'rgba(108, 92, 231, 0.18)',
  },
  clip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  mono: {
    paddingHorizontal: 6,
  },
  monoLetter: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
