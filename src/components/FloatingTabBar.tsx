/**
 * FloatingTabBar — floating pill with icon + persistent label per tab.
 *
 * Sliding indicator fills each tab’s measured slot (x/width/height from
 * onLayout). Height is never a leftover icon-only constant — it tracks the
 * slot that already wraps icon + label + padding.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { fontFamily, radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAuthStore } from '@/stores/authStore';
import { useAttentionTransactions } from '@/hooks/useTransactions';

interface FloatingTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  descriptors: Record<
    string,
    { options: { tabBarLabel?: string | ((props: unknown) => React.ReactNode); title?: string } }
  >;
  navigation: {
    emit: (event: {
      type: string;
      target?: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

const ICONS: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  index: { active: 'home', inactive: 'home-outline' },
  vault: { active: 'card', inactive: 'card-outline' },
  track: { active: 'analytics', inactive: 'analytics-outline' },
  assistant: { active: 'sparkles', inactive: 'sparkles-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

const TAB_ORDER = ['index', 'vault', 'track', 'assistant', 'profile'] as const;

/** Short nav labels — match in-app section names (Assist = AI Assistant tab). */
const TAB_LABELS: Record<(typeof TAB_ORDER)[number], string> = {
  index: 'Home',
  vault: 'Vault',
  track: 'Track',
  assistant: 'Assist',
  profile: 'Profile',
};

const BAR_WIDTH_RATIO = 0.9;
/** Outer chrome padding around the row of tab slots. */
const BAR_PAD_H = 4;
const BAR_PAD_V = 4;
/**
 * Gap between the slot edge and the sliding pill. Keep small so the pill
 * reads as a full segment fill, not a floating chip.
 */
const INDICATOR_INSET = 2;
/** Padding inside each tab so icon+label never touch the pill edge. */
const TAB_PAD_V = 6;
const TAB_PAD_H = 4;
/** Icon + label + gaps + tab padding — floor for every slot. */
const SLOT_MIN_HEIGHT = 52;

type TabLayout = { x: number; y: number; width: number; height: number };

const SPRING = { damping: 16, stiffness: 180, mass: 0.85 };

function TabItem({
  index,
  iconActive,
  iconInactive,
  onPress,
  label,
  activeIndex,
  reduced,
  badgeCount,
}: {
  index: number;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  activeIndex: SharedValue<number>;
  reduced: boolean;
  badgeCount?: number;
}) {
  const palette = usePalette();
  const bump = useSharedValue(1);

  const playBump = useCallback(() => {
    if (reduced) {
      bump.value = withTiming(1, { duration: 100 });
      return;
    }
    bump.value = withSequence(
      withSpring(1.06, { damping: 12, stiffness: 280 }),
      withSpring(1, motion.springConfig),
    );
  }, [bump, reduced]);

  const bumpStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bump.value }],
  }));

  const activeStyle = useAnimatedStyle(() => {
    const focus = interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: focus };
  });

  const inactiveStyle = useAnimatedStyle(() => {
    const focus = interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: 1 - focus };
  });

  return (
    <Pressable
      onPress={() => {
        playBump();
        onPress();
      }}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
    >
      <Animated.View style={[styles.itemInner, bumpStyle]}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.iconLayer, inactiveStyle]}>
            <Ionicons name={iconInactive} size={20} color={palette.textTertiary} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, activeStyle]}>
            <Ionicons name={iconActive} size={20} color={palette.textOnAccent} />
          </Animated.View>
          {badgeCount && badgeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: palette.amber }]}>
              <Animated.Text
                style={[styles.badgeText, { color: palette.textOnAccent }]}
              >
                {badgeCount > 9 ? '9+' : String(badgeCount)}
              </Animated.Text>
            </View>
          ) : null}
        </View>

        <View style={styles.labelWrap}>
          <Animated.Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.label,
              { color: palette.textTertiary },
              inactiveStyle,
            ]}
          >
            {label}
          </Animated.Text>
          <Animated.Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.label,
              styles.labelActiveLayer,
              { color: palette.textOnAccent },
              activeStyle,
            ]}
          >
            {label}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function indicatorFrame(layout: TabLayout) {
  return {
    x: layout.x + INDICATOR_INSET,
    y: layout.y + INDICATOR_INSET,
    w: Math.max(0, layout.width - INDICATOR_INSET * 2),
    // Full measured slot height — not an icon-only constant.
    h: Math.max(0, layout.height - INDICATOR_INSET * 2),
  };
}

export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const barWidth = screenWidth * BAR_WIDTH_RATIO;
  const userId = useAuthStore((s) => s.user?.id);
  const { data: attention = [] } = useAttentionTransactions(userId);
  const trackBadge = attention.length;

  const layouts = useRef<TabLayout[]>([]);
  const [layoutsReady, setLayoutsReady] = useState(false);

  const indicatorX = useSharedValue(0);
  const indicatorY = useSharedValue(INDICATOR_INSET);
  const indicatorW = useSharedValue(48);
  const indicatorH = useSharedValue(SLOT_MIN_HEIGHT - INDICATOR_INSET * 2);
  const activeIndex = useSharedValue(state.index);
  const indicatorOpacity = useSharedValue(0);

  const applyLayout = useCallback(
    (index: number, animate: boolean) => {
      const layout = layouts.current[index];
      if (!layout) return;
      const { x, y, w, h } = indicatorFrame(layout);

      if (reduced || !animate) {
        indicatorX.value = x;
        indicatorY.value = y;
        indicatorW.value = w;
        indicatorH.value = h;
        activeIndex.value = index;
        indicatorOpacity.value = withTiming(1, { duration: reduced ? 160 : 0 });
        return;
      }
      // X/W/H/Y all spring together so the pill never clips mid-slide when
      // neighboring slots differ slightly in measured height.
      indicatorX.value = withSpring(x, SPRING);
      indicatorY.value = withSpring(y, SPRING);
      indicatorW.value = withSpring(w, SPRING);
      indicatorH.value = withSpring(h, SPRING);
      activeIndex.value = withSpring(index, SPRING);
      indicatorOpacity.value = withTiming(1, { duration: 160 });
    },
    [
      activeIndex,
      indicatorH,
      indicatorOpacity,
      indicatorW,
      indicatorX,
      indicatorY,
      reduced,
    ],
  );

  useEffect(() => {
    if (!layoutsReady) return;
    const focusedName = state.routes[state.index]?.name;
    const layoutIndex = TAB_ORDER.indexOf(
      focusedName as (typeof TAB_ORDER)[number],
    );
    if (layoutIndex >= 0) applyLayout(layoutIndex, true);
  }, [state.index, state.routes, layoutsReady, applyLayout]);

  const onTabLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    layouts.current[index] = { x, y, width, height };
    if (layouts.current.filter(Boolean).length === TAB_ORDER.length) {
      const focusedName = state.routes[state.index]?.name;
      const layoutIndex = TAB_ORDER.indexOf(
        focusedName as (typeof TAB_ORDER)[number],
      );
      const target = layoutIndex >= 0 ? layoutIndex : 0;
      if (!layoutsReady) {
        const layout = layouts.current[target];
        if (layout) {
          const frame = indicatorFrame(layout);
          indicatorX.value = frame.x;
          indicatorY.value = frame.y;
          indicatorW.value = frame.w;
          indicatorH.value = frame.h;
          activeIndex.value = target;
          indicatorOpacity.value = 1;
        }
        setLayoutsReady(true);
      } else {
        applyLayout(target, false);
      }
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    width: indicatorW.value,
    height: indicatorH.value,
    transform: [
      { translateX: indicatorX.value },
      { translateY: indicatorY.value },
    ],
  }));

  return (
    <View
      style={[styles.container, { bottom: insets.bottom + spacing.sm }]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={30}
        tint={palette.blurTint}
        style={[
          styles.bar,
          {
            width: barWidth,
            borderColor: palette.glassBorderStrong,
            backgroundColor: palette.navy800,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.indicator,
            indicatorStyle,
            { backgroundColor: palette.indigo },
          ]}
          pointerEvents="none"
        />

        {state.routes
          .filter((route) =>
            TAB_ORDER.includes(route.name as (typeof TAB_ORDER)[number]),
          )
          .map((route) => {
            const index = state.routes.findIndex((r) => r.key === route.key);
            const icons = ICONS[route.name] ?? ICONS.index;
            const layoutIndex = TAB_ORDER.indexOf(
              route.name as (typeof TAB_ORDER)[number],
            );
            const label =
              TAB_LABELS[route.name as (typeof TAB_ORDER)[number]] ??
              (typeof descriptors[route.key]?.options.tabBarLabel === 'string'
                ? (descriptors[route.key].options.tabBarLabel as string)
                : descriptors[route.key]?.options.title ?? route.name);
            const focused = state.index === index;

            const onPress = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              applyLayout(layoutIndex, true);
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <View
                key={route.key}
                style={styles.itemSlot}
                onLayout={(e) => onTabLayout(layoutIndex, e)}
              >
                <TabItem
                  index={layoutIndex}
                  iconActive={icons.active}
                  iconInactive={icons.inactive}
                  onPress={onPress}
                  label={label}
                  activeIndex={activeIndex}
                  reduced={reduced}
                  badgeCount={route.name === 'track' ? trackBadge : undefined}
                />
              </View>
            );
          })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: BAR_PAD_H,
    paddingVertical: BAR_PAD_V,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 12 },
    }),
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radius.lg,
    zIndex: 0,
  },
  itemSlot: {
    flex: 1,
    minHeight: SLOT_MIN_HEIGHT,
    zIndex: 1,
  },
  item: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SLOT_MIN_HEIGHT,
    paddingVertical: TAB_PAD_V,
    paddingHorizontal: TAB_PAD_H,
  },
  itemInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 28,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    height: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: 'center',
    width: '100%',
  },
  labelActiveLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    lineHeight: 11,
  },
});
