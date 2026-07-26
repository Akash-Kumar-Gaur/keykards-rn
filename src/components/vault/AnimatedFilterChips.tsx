/**
 * AnimatedFilterChips — horizontally scrollable chips with a sliding indigo
 * indicator (same spring language as FloatingTabBar).
 */

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface FilterChipOption {
  id: string;
  label: string;
  accessibilityLabel?: string;
  /** Optional leading mark (e.g. NetworkBadge). When set with iconOnly, label is a11y-only. */
  leading?: ReactNode | ((active: boolean) => ReactNode);
  iconOnly?: boolean;
}

interface AnimatedFilterChipsProps {
  options: FilterChipOption[];
  value: string;
  onChange: (id: string) => void;
}

type ChipLayout = { x: number; width: number };

const SPRING = { damping: 16, stiffness: 180, mass: 0.85 };
const MIN_TOUCH = 44;

export function AnimatedFilterChips({
  options,
  value,
  onChange,
}: AnimatedFilterChipsProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const layouts = useRef<Record<string, ChipLayout>>({});
  const [ready, setReady] = useState(false);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );

  const moveIndicator = useCallback(
    (id: string) => {
      const layout = layouts.current[id];
      if (!layout) return;
      if (reduced) {
        indicatorX.value = withTiming(layout.x, { duration: 120 });
        indicatorW.value = withTiming(layout.width, { duration: 120 });
      } else {
        indicatorX.value = withSpring(layout.x, SPRING);
        indicatorW.value = withSpring(layout.width, SPRING);
      }
    },
    [indicatorW, indicatorX, reduced],
  );

  useEffect(() => {
    if (!ready) return;
    moveIndicator(options[activeIndex]?.id ?? options[0]?.id);
  }, [activeIndex, moveIndicator, options, ready, value]);

  const onChipLayout = (id: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts.current[id] = { x, width };
    if (Object.keys(layouts.current).length >= options.length) {
      setReady(true);
      if (id === value) {
        indicatorX.value = x;
        indicatorW.value = width;
      }
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
    opacity: ready ? 1 : 0,
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <View
        style={[
          styles.track,
          {
            backgroundColor: palette.glassFill,
            borderColor: palette.glassBorder,
          },
        ]}
      >
        <Animated.View
          style={[styles.indicator, { backgroundColor: palette.indigo }, indicatorStyle]}
        />
        {options.map((opt) => {
          const active = opt.id === value;
          const a11y = opt.accessibilityLabel ?? opt.label;
          const leading =
            typeof opt.leading === 'function' ? opt.leading(active) : opt.leading;
          return (
            <Pressable
              key={opt.id}
              onLayout={(e) => onChipLayout(opt.id, e)}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(opt.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={a11y}
              style={[
                styles.chip,
                opt.iconOnly && styles.chipIconOnly,
                { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH },
              ]}
            >
              {leading}
              {!opt.iconOnly ? (
                <AppText
                  variant="small"
                  color={active ? palette.textOnAccent : palette.textSecondary}
                >
                  {opt.label}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 3,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    zIndex: 1,
    // Keep icon-only chips from expanding when badges draw an outside ring
    overflow: 'visible',
  },
  chipIconOnly: {
    paddingHorizontal: spacing.sm,
    // Stable touch box — badge size is fixed; don't grow with selection chrome
    height: MIN_TOUCH,
  },
});
