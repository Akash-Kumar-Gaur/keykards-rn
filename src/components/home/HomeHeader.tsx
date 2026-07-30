/**
 * HomeHeader — time-based greeting + display name + account status control.
 * Matches Track’s muted-label / bold-headline pairing.
 */

import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAuthStore } from '@/stores/authStore';
import { useProfile } from '@/hooks/useProfile';
import {
  greetingFirstName,
  resolveDisplayName,
} from '@/lib/displayName';

function timeGreeting(hasName: boolean, now = new Date()): string {
  const h = now.getHours();
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return hasName ? `${base},` : base;
}

export function HomeHeader({ onAccount }: { onAccount: () => void }) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useProfile(user?.id);

  const displayName = useMemo(
    () => resolveDisplayName(user, profile?.displayName ?? null),
    [user, profile?.displayName],
  );
  const greetingName = displayName ? greetingFirstName(displayName) : null;
  const greeting = useMemo(
    () => timeGreeting(Boolean(greetingName)),
    [greetingName],
  );

  const greetOpacity = useSharedValue(0);
  const greetY = useSharedValue(10);
  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(10);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      greetOpacity.value = 1;
      greetY.value = 0;
      nameOpacity.value = 1;
      nameY.value = 0;
      pulse.value = 1;
      return;
    }
    greetOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    greetY.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
    nameOpacity.value = withDelay(
      80,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    nameY.value = withDelay(
      80,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const greetStyle = useAnimatedStyle(() => ({
    opacity: greetOpacity.value,
    transform: [{ translateY: greetY.value }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.55 + (pulse.value - 1) * 0.9,
  }));

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Animated.View style={greetStyle}>
          <AppText variant="small" color={palette.textSecondary}>
            {greeting}
          </AppText>
        </Animated.View>
        {greetingName ? (
          <Animated.View style={nameStyle}>
            <AppText variant="h2" style={styles.name} numberOfLines={1}>
              {greetingName}
            </AppText>
          </Animated.View>
        ) : null}
      </View>

      <Pressable
        onPress={onAccount}
        accessibilityRole="button"
        accessibilityLabel="Account"
        hitSlop={8}
        style={[
          styles.accountBtn,
          {
            backgroundColor: palette.navy800,
            borderColor: palette.glassBorder,
          },
        ]}
      >
        <Ionicons name="person-outline" size={20} color={palette.textSecondary} />
        <View style={styles.dotWrap} pointerEvents="none">
          {!reduced ? (
            <Animated.View
              style={[
                styles.dotPulse,
                { backgroundColor: palette.green },
                pulseStyle,
              ]}
            />
          ) : null}
          <View style={[styles.dot, { backgroundColor: palette.green }]} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  brand: { flex: 1, minWidth: 0, gap: 2, paddingRight: spacing.md },
  name: { letterSpacing: 0.2 },
  accountBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dotWrap: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPulse: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
