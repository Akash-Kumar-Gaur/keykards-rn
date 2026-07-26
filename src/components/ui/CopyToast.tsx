/**
 * Tiny inline toast for copy confirmation — no sensitive values in the message.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function CopyToast({
  message,
  visible,
}: {
  message: string | null;
  visible: boolean;
}) {
  const palette = usePalette();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible && message ? 1 : 0, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { borderColor: palette.glassBorderStrong }, style]}
    >
      <AppText variant="caption" color={palette.textOnAccent}>
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 10, 20, 0.88)',
    borderWidth: 1,
    zIndex: 20,
  },
});
