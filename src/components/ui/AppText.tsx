/**
 * Typography components. Default text color follows the active app theme.
 */

import React from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';
import { fontFamily, fontSize, letterSpacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Variant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'bodyLg'
  | 'body'
  | 'small'
  | 'caption'
  | 'stat';

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  display: { fontFamily: fontFamily.displayExtra, fontSize: fontSize.display, letterSpacing: letterSpacing.tight },
  h1: { fontFamily: fontFamily.display, fontSize: fontSize.h1, letterSpacing: letterSpacing.tight },
  h2: { fontFamily: fontFamily.display, fontSize: fontSize.h2, letterSpacing: letterSpacing.tight },
  title: { fontFamily: fontFamily.displaySemi, fontSize: fontSize.title },
  bodyLg: { fontFamily: fontFamily.regular, fontSize: fontSize.bodyLg },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body },
  small: { fontFamily: fontFamily.regular, fontSize: fontSize.small },
  caption: { fontFamily: fontFamily.medium, fontSize: fontSize.caption },
  stat: { fontFamily: fontFamily.bold, fontSize: fontSize.stat },
};

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AppText({
  variant = 'body',
  color,
  style,
  ...rest
}: AppTextProps) {
  const palette = usePalette();
  return (
    <Text
      {...rest}
      style={[VARIANT_STYLE[variant], { color: color ?? palette.textPrimary }, style]}
    />
  );
}

/**
 * Eyebrow — small-caps, letter-spaced label (e.g. "YOUR WALLET, UPGRADED").
 */
export function Eyebrow({
  children,
  color,
  style,
}: {
  children: string;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const palette = usePalette();
  return (
    <Text
      style={[
        {
          fontFamily: fontFamily.bold,
          fontSize: fontSize.eyebrow,
          letterSpacing: letterSpacing.eyebrow,
          color: color ?? palette.textSecondary,
        },
        style,
      ]}
    >
      {children.toUpperCase()}
    </Text>
  );
}
