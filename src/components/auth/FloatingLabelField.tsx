/**
 * FloatingLabelField — label rests vertically centered; on focus/value it scales
 * up to a top caption. Border glow neutral → indigo.
 */

import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing, fontFamily, fontSize } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

/** Fixed field geometry so resting/floated label positions are intentional. */
const FIELD_HEIGHT = 58;
const WRAP_HEIGHT = 44;
const LABEL_LINE = 20;
/** Vertically centers a ~20px label line inside the 44px wrap. */
const LABEL_REST_TOP = (WRAP_HEIGHT - LABEL_LINE) / 2;
/** Caption position after float. */
const LABEL_FLOAT_TOP = 0;

interface FloatingLabelFieldProps extends TextInputProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Override typed-text color (e.g. transparent under a mask overlay). */
  inputColor?: string;
  /** Outer field container style (not the TextInput). */
  containerStyle?: ViewStyle | ViewStyle[];
}

export function FloatingLabelField({
  label,
  icon,
  value,
  onFocus,
  onBlur,
  inputColor,
  containerStyle,
  multiline,
  style,
  ...rest
}: FloatingLabelFieldProps) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  const active = useSharedValue(0);
  const hasValue = Boolean(value && String(value).length > 0);
  // Multiline keeps the caption parked at the top so body text never sits under it.
  const floated = multiline || focused || hasValue;

  useEffect(() => {
    active.value = withTiming(floated ? 1 : 0, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floated]);

  const focusGlow = useSharedValue(0);
  useEffect(() => {
    focusGlow.value = withTiming(focused ? 1 : 0, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const labelStyle = useAnimatedStyle(() => ({
    top: interpolate(active.value, [0, 1], [LABEL_REST_TOP, LABEL_FLOAT_TOP]),
    // Animate font size instead of transformOrigin. Android Fabric expects
    // transformOrigin as an array and crashes when a string reaches RCTText.
    // Font-size interpolation keeps the label anchored to its left edge.
    fontSize: interpolate(active.value, [0, 1], [fontSize.body, fontSize.caption]),
    opacity: interpolate(active.value, [0, 1], [0.7, 1]),
  }));

  const inputStyle = useAnimatedStyle(() => ({
    // Single-line: nudge text down under the floated caption.
    // Multiline: wrap already reserves caption height — keep padding light.
    paddingTop: interpolate(
      active.value,
      [0, 1],
      [0, multiline ? 0 : 12],
    ),
  }));

  const borderStyle = useAnimatedStyle(
    () => ({
      borderColor: interpolateColor(
        focusGlow.value,
        [0, 1],
        [palette.glassBorder, palette.indigo],
      ),
      shadowOpacity: interpolate(focusGlow.value, [0, 1], [0, 0.35]),
    }),
    [palette.glassBorder, palette.indigo],
  );

  return (
    <Animated.View
      style={[
        styles.field,
        {
          backgroundColor: palette.glassFill,
          shadowColor: palette.indigo,
        },
        multiline && styles.fieldMultiline,
        borderStyle,
        containerStyle,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={focused ? palette.indigo : palette.textTertiary}
        style={multiline ? styles.iconMultiline : undefined}
      />
      <View style={[styles.inputWrap, multiline && styles.inputWrapMultiline]}>
        <Animated.Text style={[styles.label, { color: palette.textSecondary }, labelStyle]}>
          {label}
        </Animated.Text>
        <Animated.View style={[styles.inputAnim, inputStyle, multiline && styles.inputAnimMultiline]}>
          <TextInput
            {...rest}
            value={value}
            multiline={multiline}
            placeholder=""
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              styles.input,
              { color: inputColor ?? palette.textPrimary },
              multiline && styles.inputMultiline,
              style,
            ]}
            placeholderTextColor="transparent"
            textAlignVertical={multiline ? 'top' : undefined}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: FIELD_HEIGHT,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  fieldMultiline: {
    height: undefined,
    minHeight: FIELD_HEIGHT + 48,
    alignItems: 'flex-start',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconMultiline: {
    marginTop: 2,
  },
  inputWrap: {
    flex: 1,
    height: WRAP_HEIGHT,
    justifyContent: 'center',
    overflow: 'visible',
  },
  inputWrapMultiline: {
    height: undefined,
    minHeight: WRAP_HEIGHT + 48,
    paddingTop: LABEL_LINE + 4,
  },
  label: {
    position: 'absolute',
    left: 0,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    lineHeight: LABEL_LINE,
    zIndex: 1,
  },
  inputAnim: {
    flex: 1,
    justifyContent: 'center',
  },
  inputAnimMultiline: {
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: LABEL_LINE,
    padding: 0,
    margin: 0,
    ...Platform.select({
      android: { textAlignVertical: 'center' as const },
      default: {},
    }),
  },
  inputMultiline: {
    minHeight: 64,
    ...Platform.select({
      android: { textAlignVertical: 'top' as const },
      default: {},
    }),
  },
});
