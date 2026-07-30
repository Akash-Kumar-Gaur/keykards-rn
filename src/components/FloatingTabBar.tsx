/**
 * FloatingTabBar — icon-only dock with a small sliding dot under the active tab.
 * No persistent text labels (a11y via accessibilityLabel).
 */

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAttentionTransactions } from '@/hooks/useTransactions';
import { usePalette } from '@/providers/AppThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { fontFamily, radius, spacing } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const TAB_A11Y: Record<(typeof TAB_ORDER)[number], string> = {
  index: 'Home',
  vault: 'Vault',
  track: 'Track',
  assistant: 'Assist',
  profile: 'Profile',
};

const BAR_WIDTH_RATIO = 0.72;
const BAR_PAD = 6;
const SLOT_SIZE = 48;
const ICON_SIZE = 22;
const DOT_SIZE = 5;
/** Vertical offset from slot center to place the dot under the icon. */
const DOT_Y_FROM_CENTER = 14;

type TabLayout = { x: number; y: number; width: number; height: number };

const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };
const PRESS_SPRING = { damping: 14, stiffness: 320, mass: 0.55 };

function TabItem({
  index,
  iconActive,
  iconInactive,
  onPress,
  a11yLabel,
  activeIndex,
  reduced,
  badgeCount,
}: {
  index: number;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  a11yLabel: string;
  activeIndex: SharedValue<number>;
  reduced: boolean;
  badgeCount?: number;
}) {
  const palette = usePalette();
  const press = useSharedValue(1);

  const onPressIn = useCallback(() => {
    press.value = reduced
      ? withTiming(0.92, { duration: 80 })
      : withSpring(0.88, PRESS_SPRING);
  }, [press, reduced]);

  const onPressOut = useCallback(() => {
    press.value = reduced
      ? withTiming(1, { duration: 120 })
      : withSequence(withSpring(1.08, PRESS_SPRING), withSpring(1, SPRING));
  }, [press, reduced]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const focus = interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: 0.92 + focus * 0.1 }],
    };
  });

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
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityLabel={a11yLabel}
      hitSlop={6}
    >
      <Animated.View style={[styles.itemInner, pressStyle]}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Animated.View style={[styles.iconLayer, inactiveStyle]}>
            <Ionicons name={iconInactive} size={ICON_SIZE} color={palette.textTertiary} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, activeStyle]}>
            <Ionicons name={iconActive} size={ICON_SIZE} color={palette.indigo} />
          </Animated.View>
          {badgeCount && badgeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: palette.amber }]}>
              <Animated.Text style={[styles.badgeText, { color: palette.textOnAccent }]}>
                {badgeCount > 9 ? '9+' : String(badgeCount)}
              </Animated.Text>
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function dotFrame(layout: TabLayout) {
  return {
    x: layout.x + layout.width / 2 - DOT_SIZE / 2,
    y: layout.y + layout.height / 2 + DOT_Y_FROM_CENTER,
  };
}

export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const barWidth = Math.min(screenWidth * BAR_WIDTH_RATIO, 340);
  const userId = useAuthStore((s) => s.user?.id);
  const { data: attention = [] } = useAttentionTransactions(userId);
  const trackBadge = attention.length;

  const layouts = useRef<TabLayout[]>([]);
  const [layoutsReady, setLayoutsReady] = useState(false);

  const indicatorX = useSharedValue(0);
  const indicatorY = useSharedValue(0);
  const activeIndex = useSharedValue(state.index);
  const indicatorOpacity = useSharedValue(0);

  const applyLayout = useCallback(
    (index: number, animate: boolean) => {
      const layout = layouts.current[index];
      if (!layout) return;
      const { x, y } = dotFrame(layout);

      if (reduced || !animate) {
        indicatorX.value = x;
        indicatorY.value = y;
        activeIndex.value = index;
        indicatorOpacity.value = withTiming(1, { duration: reduced ? 160 : 0 });
        return;
      }

      indicatorX.value = withSpring(x, SPRING);
      indicatorY.value = withSpring(y, SPRING);
      activeIndex.value = withSpring(index, SPRING);
      indicatorOpacity.value = withTiming(1, { duration: 140 });
    },
    [activeIndex, indicatorOpacity, indicatorX, indicatorY, reduced],
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
          const frame = dotFrame(layout);
          indicatorX.value = frame.x;
          indicatorY.value = frame.y;
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
        intensity={42}
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
            { backgroundColor: palette.indigo },
            indicatorStyle,
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
            const a11yLabel =
              TAB_A11Y[route.name as (typeof TAB_ORDER)[number]] ??
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
                  a11yLabel={a11yLabel}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: BAR_PAD,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.32,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 14 },
    }),
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    zIndex: 0,
  },
  itemSlot: {
    flex: 1,
    height: SLOT_SIZE,
    zIndex: 1,
  },
  item: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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
  badge: {
    position: 'absolute',
    top: -3,
    right: -7,
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
