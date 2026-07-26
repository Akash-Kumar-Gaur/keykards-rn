/**
 * AuthModeTabs — Sign in / Sign up with a sliding indigo pill indicator.
 */

import React, { useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export type AuthMode = 'signIn' | 'signUp';

interface AuthModeTabsProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

export function AuthModeTabs({ mode, onChange }: AuthModeTabsProps) {
  const palette = usePalette();
  const index = mode === 'signIn' ? 0 : 1;
  const width = useSharedValue(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (width.value === 0) return;
    x.value = withSpring(index * (width.value / 2), motion.springConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    width.value = w;
    x.value = index * (w / 2);
  };

  const pillStyle = useAnimatedStyle(() => ({
    width: width.value > 0 ? width.value / 2 - 4 : 0,
    transform: [{ translateX: x.value + 2 }],
  }));

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: palette.glassFill, borderColor: palette.glassBorder },
      ]}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.pill, { backgroundColor: palette.indigo }, pillStyle]} />
      <Pressable style={styles.tab} onPress={() => onChange('signIn')}>
        <AppText
          variant="body"
          color={mode === 'signIn' ? palette.textOnAccent : palette.textSecondary}
        >
          Sign in
        </AppText>
      </Pressable>
      <Pressable style={styles.tab} onPress={() => onChange('signUp')}>
        <AppText
          variant="body"
          color={mode === 'signUp' ? palette.textOnAccent : palette.textSecondary}
        >
          Sign up
        </AppText>
      </Pressable>
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
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    zIndex: 1,
  },
});
