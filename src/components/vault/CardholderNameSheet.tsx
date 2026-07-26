/**
 * CardholderNameSheet — single-field edit for printed name on card.
 * No biometric, no full Edit Card form. Saves via useUpdateCardholderName.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { usePalette } from '@/providers/AppThemeProvider';
import { useUpdateCardholderName } from '@/hooks/useCards';
import { spacing } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  cardId: string;
  userId: string | undefined;
  initialName: string | null;
};

export function CardholderNameSheet({
  visible,
  onClose,
  cardId,
  userId,
  initialName,
}: Props) {
  const palette = usePalette();
  const update = useUpdateCardholderName(userId);
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
    if (!userId) {
      setError('Sign in to save the name on card.');
      return;
    }
    try {
      await update.mutateAsync({
        cardId,
        cardholderName: value,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save name.');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Eyebrow color={palette.indigo}>Card details</Eyebrow>
      <AppText variant="h2" style={styles.title}>
        Name on card
      </AppText>
      <AppText variant="small" color={palette.textSecondary} style={styles.hint}>
        Printed name as it appears on the card. Editable anytime.
      </AppText>
      <FloatingLabelField
        label="Name on card"
        icon="person-outline"
        value={value}
        onChangeText={(t) => setValue(t.slice(0, 80))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={save}
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
          onPress={save}
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
