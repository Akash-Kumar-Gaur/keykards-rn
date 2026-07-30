/**
 * DisplayNameSheet — single-field edit for account full name.
 * Same pattern as CardholderNameSheet: no biometric, no full-screen form.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { usePalette } from '@/providers/AppThemeProvider';
import { useUpdateDisplayName } from '@/hooks/useProfile';
import { DISPLAY_NAME_MAX, validateDisplayNameInput } from '@/lib/displayName';
import { spacing } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
  initialName: string | null;
};

export function DisplayNameSheet({
  visible,
  onClose,
  userId,
  initialName,
}: Props) {
  const palette = usePalette();
  const update = useUpdateDisplayName(userId);
  const [value, setValue] = useState(initialName ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(initialName ?? '');
      setError(null);
    }
  }, [visible, initialName]);

  const save = async () => {
    setError(null);
    const validation = validateDisplayNameInput(value);
    if (validation) {
      setError(validation);
      return;
    }
    if (!userId) {
      setError('Sign in to save your name.');
      return;
    }
    try {
      await update.mutateAsync(value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save name.');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Eyebrow color={palette.indigo}>Account</Eyebrow>
      <AppText variant="h2" style={styles.title}>
        Your name
      </AppText>
      <AppText variant="small" color={palette.textSecondary} style={styles.hint}>
        Shown in your Home greeting and Account profile. Editable anytime.
      </AppText>
      <FloatingLabelField
        label="Full name"
        icon="person-outline"
        value={value}
        onChangeText={(t) => setValue(t.slice(0, DISPLAY_NAME_MAX))}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      {error ? (
        <AppText variant="caption" color={palette.danger}>
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <PillButton
          label="Cancel"
          variant="ghost"
          onPress={onClose}
          disabled={update.isPending}
          style={styles.actionBtn}
        />
        <PillButton
          label={update.isPending ? 'Saving…' : 'Save'}
          onPress={() => void save()}
          loading={update.isPending}
          style={styles.actionBtn}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xs },
  hint: { marginBottom: spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: { flex: 1 },
});
