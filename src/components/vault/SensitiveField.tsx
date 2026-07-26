/**
 * SensitiveField — always-masked secure input (CVV).
 * No reveal toggle — CVV should not be re-readable after entry.
 * Never logs value; callers must not pass value into logger/analytics.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';

interface SensitiveFieldProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'number-pad' | 'default';
  maxLength?: number;
  placeholder?: string;
}

export function SensitiveField({
  label,
  icon,
  value,
  onChangeText,
  keyboardType = 'number-pad',
  maxLength,
  placeholder,
}: SensitiveFieldProps) {
  return (
    <FloatingLabelField
      label={label}
      icon={icon}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      maxLength={maxLength}
      placeholder={placeholder}
      secureTextEntry
      autoCorrect={false}
      autoCapitalize="none"
      textContentType="none"
      importantForAutofill="no"
      containerStyle={styles.field}
    />
  );
}

const styles = StyleSheet.create({
  field: {},
});
