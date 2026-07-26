/**
 * Glass treatment shared by Vault density tiers.
 * Tint and fills follow the active app theme.
 */

import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '@/theme';
import { useAppTheme, usePalette } from '@/providers/AppThemeProvider';

const BLUR_SUPPORTED = Platform.OS === 'ios';

export function TopEdgeHighlight({
  radius: r = radius.xl,
  height = 10,
  strength,
}: {
  radius?: number;
  height?: number;
  strength?: number;
}) {
  const { isLight } = useAppTheme();
  const s = strength ?? (isLight ? 0.55 : 0.14);
  const top = isLight
    ? `rgba(255,255,255,${s})`
    : `rgba(255,255,255,${s})`;
  const mid = isLight
    ? `rgba(255,255,255,${s * 0.35})`
    : `rgba(255,255,255,${s * 0.3})`;

  return (
    <LinearGradient
      pointerEvents="none"
      colors={[top, mid, 'rgba(255,255,255,0)']}
      locations={[0, 0.35, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.topEdge,
        { height, borderTopLeftRadius: r, borderTopRightRadius: r },
      ]}
    />
  );
}

export function GlassSurface({
  children,
  style,
  cornerRadius = radius.xl,
  blur = false,
  blurIntensity = 18,
  strong = false,
  highlight = true,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  cornerRadius?: number;
  blur?: boolean;
  blurIntensity?: number;
  strong?: boolean;
  highlight?: boolean;
}) {
  const palette = usePalette();
  const useBlur = blur && BLUR_SUPPORTED;

  return (
    <View
      style={[
        styles.surface,
        {
          borderRadius: cornerRadius,
          backgroundColor: strong ? palette.glassFillStrong : palette.glassFill,
          borderColor: strong ? palette.glassBorderStrong : palette.glassBorder,
        },
        style,
      ]}
    >
      {useBlur ? (
        <BlurView
          tint={palette.blurTint}
          intensity={blurIntensity}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {highlight ? <TopEdgeHighlight radius={cornerRadius} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  topEdge: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
  },
});
