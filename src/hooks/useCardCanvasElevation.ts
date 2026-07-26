/**
 * Elevation for metallic payment-card faces.
 *
 * Dark: wide soft float (reads against near-black canvas).
 * Light: soft tight table-top shadow only — dark-mode spread/opacity on a warm
 * white page reads as a thick border / padded halo.
 *
 * Always use this instead of stacking `shadow.card` + light elevation.
 */

import { useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import { useAppTheme } from '@/providers/AppThemeProvider';
import { shadow } from '@/theme';

export function useCardCanvasElevation(): ViewStyle {
  const { palette, isLight } = useAppTheme();
  return useMemo(() => {
    if (!isLight) {
      return {
        shadowColor: shadow.card.shadowColor,
        shadowOpacity: shadow.card.shadowOpacity,
        shadowRadius: shadow.card.shadowRadius,
        shadowOffset: shadow.card.shadowOffset,
        elevation: shadow.card.elevation,
      };
    }
    const s = palette.cardOnCanvasShadow;
    return {
      shadowColor: s.shadowColor,
      shadowOpacity: s.shadowOpacity,
      shadowRadius: s.shadowRadius,
      shadowOffset: s.shadowOffset,
      elevation: s.elevation,
    };
  }, [isLight, palette]);
}
