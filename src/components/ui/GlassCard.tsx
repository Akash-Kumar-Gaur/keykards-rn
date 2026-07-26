/**
 * GlassCard — soft-glass panel.
 *  - Dark: single translucent view (fill lets the near-black page show through).
 *  - Light: ONE opaque elevated plate (fill + border + shadow). Inner view only
 *    clips children — never a second opaque fill (that stacked white plate was
 *    the recurring corner/halo artifact on warm canvas).
 *
 * Elevation levels (light only):
 *  - flat: border only (grouped secondary tiles)
 *  - raised: default soft table-top lift
 *  - emphasis: slightly stronger for section anchors (milestone)
 *
 * Layer map (light) — set DEBUG_CARD_LAYERS to outline:
 *  - outer (elevation + fill + border) → was red
 *  - inner (clip/pad only, no fill) → was blue
 */

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing } from '@/theme';
import { useAppTheme, usePalette } from '@/providers/AppThemeProvider';

export type GlassElevation = 'flat' | 'raised' | 'emphasis';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  padding?: number;
  /** Light-mode elevation. Dark ignores (no drop shadow on glass). */
  elevation?: GlassElevation;
}

/** Flip to true locally to outline outer vs inner layers. */
const DEBUG_CARD_LAYERS = false;

const SELF_LAYOUT_KEYS = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'zIndex',
] as const;

const LIGHT_ELEVATION: Record<GlassElevation, ViewStyle | null> = {
  flat: null,
  raised: {
    shadowColor: '#1A2038',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  emphasis: {
    shadowColor: '#1A2038',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
};

export function GlassCard({
  children,
  style,
  strong = false,
  padding = spacing.xl,
  elevation = 'raised',
}: GlassCardProps) {
  const palette = usePalette();
  const { isLight } = useAppTheme();

  const fill = strong ? palette.glassFillStrong : palette.glassFill;
  const border = strong ? palette.glassBorderStrong : palette.glassBorder;

  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const cornerRadius =
    typeof flat.borderRadius === 'number' ? flat.borderRadius : radius.xl;
  const innerPadding =
    typeof flat.padding === 'number' ? flat.padding : padding;

  if (!isLight) {
    return (
      <View
        style={[
          styles.dark,
          { padding: innerPadding, backgroundColor: fill, borderColor: border },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const outerLayout: ViewStyle = {};
  const innerLayout: ViewStyle = {};
  for (const [key, value] of Object.entries(flat)) {
    if ((SELF_LAYOUT_KEYS as readonly string[]).includes(key)) {
      (outerLayout as Record<string, unknown>)[key] = value;
    } else if (
      key !== 'borderRadius' &&
      key !== 'padding' &&
      // Never re-apply a second fill/border on the clip layer.
      key !== 'backgroundColor' &&
      key !== 'borderColor' &&
      key !== 'borderWidth' &&
      key !== 'overflow'
    ) {
      (innerLayout as Record<string, unknown>)[key] = value;
    }
  }

  const shadow = LIGHT_ELEVATION[elevation];

  return (
    <View
      style={[
        outerLayout,
        {
          borderRadius: cornerRadius,
          backgroundColor: fill,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: border,
          ...shadow,
        },
        DEBUG_CARD_LAYERS && styles.debugOuter,
      ]}
    >
      <View
        style={[
          styles.clip,
          innerLayout,
          {
            padding: innerPadding,
            borderRadius: cornerRadius,
          },
          DEBUG_CARD_LAYERS && styles.debugInner,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  /** Clip only — no fill, no border (those live on the elevated plate). */
  clip: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  debugOuter: {
    borderWidth: 2,
    borderColor: '#FF0000',
  },
  debugInner: {
    borderWidth: 2,
    borderColor: '#0000FF',
  },
});
