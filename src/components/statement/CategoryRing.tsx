/**
 * CategoryRing — multi-segment donut for statement category spend.
 * Reuses the same indigo/amber/green tones as RadialProgress / IconBadge.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText } from '@/components/ui/AppText';
import { categoryMeta } from '@/components/card/benefitCategoryMeta';
import type { StatementCategory } from '@/lib/statementParse';
import { usePalette } from '@/providers/AppThemeProvider';

export type CategorySegment = {
  cat: StatementCategory;
  amount: number;
  share: number;
};

type Props = {
  segments: CategorySegment[];
  size?: number;
  strokeWidth?: number;
};

export function CategoryRing({
  segments,
  size = 112,
  strokeWidth = 12,
}: Props) {
  const palette = usePalette();
  const toneStroke = useMemo(
    (): Record<string, string> => ({
      indigo: palette.indigo,
      amber: palette.amber,
      green: palette.green,
    }),
    [palette.indigo, palette.amber, palette.green],
  );

  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const arcs = useMemo(() => {
    const gap = segments.length > 1 ? 3 : 0;
    // Each arc starts where the previous one ended, so offsets accumulate.
    return segments.reduce<
      { cat: string; stroke: string; dasharray: string; dashoffset: number }[]
    >((acc, s, i) => {
      const previous = segments
        .slice(0, i)
        .reduce((sum, p) => sum + Math.max(0, Math.min(1, p.share)) * circumference, 0);
      const len = Math.max(0, Math.min(1, s.share)) * circumference;
      const draw = Math.max(0, len - gap);
      const stroke = toneStroke[categoryMeta(s.cat).tone] ?? palette.indigo;
      acc.push({
        cat: s.cat,
        stroke,
        dasharray: `${draw} ${circumference - draw}`,
        dashoffset: -previous,
      });
      return acc;
    }, []);
  }, [segments, circumference, toneStroke, palette.indigo]);

  const topShare = segments[0] ? Math.round(segments[0].share * 100) : 0;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={palette.navy800}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcs.map((a) => (
          <Circle
            key={a.cat}
            cx={cx}
            cy={cy}
            r={r}
            stroke={a.stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={a.dasharray}
            strokeDashoffset={a.dashoffset}
            strokeLinecap="butt"
            rotation={-90}
            origin={`${cx}, ${cy}`}
          />
        ))}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <AppText variant="title">{topShare}%</AppText>
        <AppText variant="caption" color={palette.textTertiary}>
          top
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
