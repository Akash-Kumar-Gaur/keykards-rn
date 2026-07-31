/**
 * CardScanOverlay — card-shaped cutout (dimmed surrounds) + animated scan line.
 */

import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const ASPECT = 1.586; // ISO/IEC 7810 ID-1
const DIM = 'rgba(4, 6, 18, 0.62)';

export type ScanFrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Geometry of the card cutout. Exported so the success reveal can materialise
 * the card in exactly the rect the user was aiming at.
 */
export function scanFrameRect(winW: number, winH: number): ScanFrameRect {
  const width = Math.min(winW - spacing.xl * 2, 340);
  const height = width / ASPECT;
  return {
    x: (winW - width) / 2,
    y: Math.max((winH - height) / 2 - 40, 100),
    width,
    height,
  };
}

export function CardScanOverlay({ status }: { status: string }) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();
  const { width: frameW, height: frameH, y: topPad } = scanFrameRect(winW, winH);

  const lineY = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      lineY.value = frameH * 0.45;
      return;
    }
    lineY.value = 0;
    lineY.value = withRepeat(
      withTiming(Math.max(frameH - 4, 8), {
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [frameH, lineY, reduced]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineY.value }],
  }));

  const sideW = (winW - frameW) / 2;

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={[styles.band, { height: topPad, backgroundColor: DIM }]} />
      <View style={[styles.midRow, { height: frameH }]}>
        <View style={{ width: sideW, backgroundColor: DIM }} />
        <View style={[styles.frame, { width: frameW, borderColor: palette.indigo }]}>
          <Corner color={palette.indigo} style={styles.tl} />
          <Corner color={palette.indigo} style={styles.tr} />
          <Corner color={palette.indigo} style={styles.bl} />
          <Corner color={palette.indigo} style={styles.br} />
          <Animated.View
            style={[
              styles.scanLine,
              { backgroundColor: palette.indigo, width: frameW - 20 },
              lineStyle,
            ]}
          />
        </View>
        <View style={{ width: sideW, backgroundColor: DIM }} />
      </View>
      <View style={[styles.band, { flex: 1, backgroundColor: DIM }]}>
        <AppText
          variant="small"
          color={palette.textOnAccent}
          style={styles.status}
        >
          {status}
        </AppText>
      </View>
    </View>
  );
}

function Corner({ color, style }: { color: string; style: object }) {
  return <View style={[styles.corner, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
  },
  band: {
    width: '100%',
  },
  midRow: {
    flexDirection: 'row',
    width: '100%',
  },
  frame: {
    height: '100%',
    borderRadius: radius.lg,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    height: 2,
    borderRadius: 1,
    opacity: 0.95,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderWidth: 3,
  },
  tl: {
    top: -1,
    left: -1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.lg,
  },
  tr: {
    top: -1,
    right: -1,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: radius.lg,
  },
  bl: {
    bottom: -1,
    left: -1,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
  },
  br: {
    bottom: -1,
    right: -1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: radius.lg,
  },
  status: {
    marginTop: spacing.xl,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
