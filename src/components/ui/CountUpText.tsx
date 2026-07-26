/**
 * CountUpText — animates a numeric display from 0 → target over ~700ms via
 * Reanimated + useAnimatedReaction. Non-numeric values appear immediately.
 */

import React, { useEffect, useState } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from './AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';

function parseNumeric(value: string): { prefix: string; num: number; suffix: string } | null {
  const match = value.match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ''));
  if (Number.isNaN(num)) return null;
  return { prefix: match[1], num, suffix: match[3] };
}

function formatDuring(n: number, original: string): string {
  if (original.includes(',')) return Math.round(n).toLocaleString('en-IN');
  if (original.includes('.')) return n.toFixed(1);
  return String(Math.round(n));
}

interface CountUpTextProps {
  value: string;
  variant?: React.ComponentProps<typeof AppText>['variant'];
  color?: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
  delay?: number;
}

export function CountUpText({
  value,
  variant = 'stat',
  color,
  style,
  duration = 700,
  delay = 0,
}: CountUpTextProps) {
  const reduced = useReducedMotion();
  const parsed = parseNumeric(value);
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(
    reduced || !parsed ? value : `${parsed.prefix}0${parsed.suffix}`,
  );

  const apply = (p: number) => {
    if (!parsed) {
      setDisplay(value);
      return;
    }
    if (p >= 1) {
      setDisplay(value);
      return;
    }
    setDisplay(`${parsed.prefix}${formatDuring(parsed.num * p, value)}${parsed.suffix}`);
  };

  useAnimatedReaction(
    () => progress.value,
    (v) => {
      runOnJS(apply)(v);
    },
    [value],
  );

  useEffect(() => {
    if (!parsed || reduced) {
      setDisplay(value);
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced, duration, delay]);

  return (
    <AppText variant={variant} color={color} style={style}>
      {display}
    </AppText>
  );
}
