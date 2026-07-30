/**
 * SegmentedControl — full-width pill track with sliding selection + optional icons.
 */

import React, { useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type SegmentOption<T extends string> = {
  id: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  const trackW = useSharedValue(0);
  const x = useSharedValue(0);

  const count = options.length;
  const hasIcons = options.some((o) => o.icon);

  useEffect(() => {
    if (trackW.value === 0) return;
    const w = trackW.value / count;
    const target = index * w;
    x.value = reduced
      ? withTiming(target, { duration: 140 })
      : withSpring(target, motion.springConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, reduced]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackW.value = w;
    x.value = index * (w / count);
  };

  const pillStyle = useAnimatedStyle(() => {
    const w = trackW.value > 0 ? trackW.value / count - 4 : 0;
    return {
      width: w,
      transform: [{ translateX: x.value + 2 }],
    };
  });

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: palette.glassFill, borderColor: palette.glassBorder },
      ]}
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: palette.indigoSoft,
            borderColor: palette.indigo,
          },
          pillStyle,
        ]}
      />
      {options.map((opt) => {
        const active = opt.id === value;
        const color = active ? palette.indigo : palette.textTertiary;
        return (
          <Pressable
            key={opt.id}
            style={[styles.tab, hasIcons && styles.tabWithIcon]}
            onPress={() => onChange(opt.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={16}
                color={color}
                style={styles.icon}
              />
            ) : null}
            <AppText
              variant="small"
              color={color}
              style={active ? styles.activeLabel : undefined}
              numberOfLines={1}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 2,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    zIndex: 1,
    minHeight: 44,
  },
  tabWithIcon: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 4,
  },
  icon: { flexShrink: 0 },
  activeLabel: {
    fontWeight: '600',
  },
});
