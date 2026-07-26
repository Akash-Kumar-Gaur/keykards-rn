/**
 * AnimatedHeadline — per-line reveal (translateY + opacity), picks one of
 * several trust-first variants at random once per session (module-level).
 * Subtext fades in after the last line settles.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { fontFamily, fontSize, letterSpacing, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const HEADLINES = [
  'All your cards.\nOne place you can trust.',
  'Your cards,\nwithout the bank logins.',
  'Every card you own,\nfinally organized.',
] as const;

/** Stable for the JS session — not re-rolled on re-render. */
let sessionHeadline: string | null = null;

function pickHeadline(): string {
  if (!sessionHeadline) {
    sessionHeadline = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
  }
  return sessionHeadline;
}

function Line({
  text,
  delay,
  reduced,
  textColor,
}: {
  text: string;
  delay: number;
  reduced: boolean;
  textColor: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }],
  }));

  return (
    <View style={styles.lineClip}>
      <Animated.Text style={[styles.lineText, { color: textColor }, style]}>{text}</Animated.Text>
    </View>
  );
}

interface AnimatedHeadlineProps {
  subtext?: string;
  /** Extra delay before first line (ms), e.g. after floating cards settle. */
  startDelay?: number;
}

export function AnimatedHeadline({
  subtext = 'See every card instantly, know what\'s due before it\'s late, and add a new one in seconds. No bank app hopping, no typing 16 digits, no photos of your card in your camera roll.',
  startDelay = 420,
}: AnimatedHeadlineProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const headline = useMemo(() => pickHeadline(), []);
  const lines = headline.split('\n');
  const subProgress = useSharedValue(0);

  useEffect(() => {
    const afterLines = startDelay + lines.length * 100 + 280;
    if (reduced) {
      subProgress.value = 1;
      return;
    }
    subProgress.value = withDelay(
      afterLines,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, startDelay, lines.length]);

  const subStyle = useAnimatedStyle(() => ({
    opacity: subProgress.value,
    transform: [{ translateY: (1 - subProgress.value) * 8 }],
  }));

  return (
    <View style={styles.wrap}>
      {lines.map((line, i) => (
        <Line
          key={`${line}-${i}`}
          text={line}
          delay={startDelay + i * 100}
          reduced={reduced}
          textColor={palette.textPrimary}
        />
      ))}
      <Animated.View style={[styles.subWrap, subStyle]}>
        <AppText variant="body" color={palette.textSecondary} style={styles.subtext}>
          {subtext}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
  },
  lineClip: {
    overflow: 'hidden',
  },
  lineText: {
    fontFamily: fontFamily.displayExtra,
    fontSize: fontSize.display,
    letterSpacing: letterSpacing.tight,
    lineHeight: 40,
  },
  subWrap: {
    marginTop: spacing.md,
  },
  subtext: {
    lineHeight: 22,
    maxWidth: '94%',
  },
});
