/**
 * CardNumberField — stores full PAN digits; displays a single masked string
 * (•••• •••• •••• 4821) unless revealed. No overlay layer — avoids font-metric
 * misalignment between dots and digits.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import {
  digitsOnly,
  formatCardNumberGroups,
  formatMaskedCardNumber,
} from '@/lib/cardUtils';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

interface CardNumberFieldProps {
  label: string;
  /** Real card number (grouped or raw digits) — never logged. */
  value: string;
  onChangeText: (formattedGroups: string) => void;
  maxLength?: number;
  /** Pulse highlight after scan/catalog autofill (animates around masked value). */
  highlightToken?: number;
}

export function CardNumberField({
  label,
  value,
  onChangeText,
  maxLength = 23,
  highlightToken = 0,
}: CardNumberFieldProps) {
  const palette = usePalette();
  const [revealed, setRevealed] = useState(false);
  const digits = digitsOnly(value);
  const plainGrouped = formatCardNumberGroups(digits);
  const maskedGrouped = formatMaskedCardNumber(digits);
  const display = revealed ? plainGrouped : maskedGrouped;

  const highlight = useSharedValue(0);
  React.useEffect(() => {
    if (!highlightToken) return;
    highlight.value = withSequence(
      withTiming(1, { duration: 220 }),
      withTiming(0, { duration: 900 }),
    );
  }, [highlight, highlightToken]);

  const highlightStyle = useAnimatedStyle(
    () => ({
      borderColor: highlight.value > 0.05 ? palette.indigo : 'transparent',
      shadowOpacity: highlight.value * 0.45,
    }),
    [palette.indigo],
  );

  const commitDigits = (nextDigits: string) => {
    onChangeText(formatCardNumberGroups(nextDigits.slice(0, 19)));
  };

  const onDisplayChange = (text: string) => {
    if (revealed) {
      commitDigits(digitsOnly(text));
      return;
    }

    // Masked display: TextInput shows bullets. Reconstruct real digits from
    // length deltas — never digitsOnly(fullMasked) (that drops hidden digits).
    const prevDisplay = maskedGrouped;
    if (!text.includes('•') && !text.includes('*')) {
      // Paste / autofill of raw digits
      commitDigits(digitsOnly(text));
      return;
    }

    if (text.length > prevDisplay.length) {
      const appended = digitsOnly(text.slice(prevDisplay.length));
      if (appended) {
        commitDigits(digits + appended);
        return;
      }
      // RN sometimes rewrites the whole string; visible trailing digits only.
      const visible = digitsOnly(text);
      if (digits.length > 4) {
        commitDigits(digits.slice(0, -4) + visible);
      } else {
        commitDigits(visible);
      }
      return;
    }

    if (text.length < prevDisplay.length) {
      const removedChars = prevDisplay.length - text.length;
      // Spaces + bullets: treat each shortening as at least one digit deleted.
      const removeDigits = Math.max(1, Math.min(digits.length, removedChars));
      commitDigits(digits.slice(0, -removeDigits));
      return;
    }

    // Same length edit (overwrite) — keep visible last-4 from text.
    const visible = digitsOnly(text);
    if (digits.length > 4) {
      commitDigits(digits.slice(0, -4) + visible.slice(-4));
    } else {
      commitDigits(visible);
    }
  };

  return (
    <Animated.View style={[styles.wrap, { shadowColor: palette.indigo }, highlightStyle]}>
      <FloatingLabelField
        label={label}
        icon="card-outline"
        value={display}
        onChangeText={onDisplayChange}
        keyboardType="number-pad"
        maxLength={maxLength}
        autoCorrect={false}
        autoCapitalize="none"
        textContentType="none"
        importantForAutofill="no"
        // Keep caret at end while masked so mid-string edits don't scramble bullets.
        selection={
          revealed || display.length === 0
            ? undefined
            : { start: display.length, end: display.length }
        }
        style={styles.monoInput}
        containerStyle={styles.field}
      />
      <Pressable
        onPress={() => setRevealed((v) => !v)}
        hitSlop={10}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={revealed ? 'Hide card number' : 'Show card number'}
        accessibilityState={{ checked: revealed }}
      >
        <Ionicons
          name={revealed ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={palette.textSecondary}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  field: { paddingRight: 44 },
  monoInput: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  toggle: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 2,
  },
});
