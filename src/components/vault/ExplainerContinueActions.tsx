/**
 * Shared Continue / cancel footer for the NFC and camera privacy explainers.
 *
 * Continue stays disabled for a short countdown so the copy is actually read.
 * An optional "Don't show again" checkbox persists a skip preference for that
 * capture path only (NFC vs scan stay independent).
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import {
  setSkipCaptureExplainer,
  type CaptureExplainerKind,
} from '@/lib/captureExplainerPrefs';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

/** Seconds Continue stays locked — long enough to skim the privacy bullets. */
const CONTINUE_LOCK_SECONDS = 3;

export function ExplainerContinueActions({
  kind,
  onContinue,
  onCancel,
  cancelLabel,
}: {
  kind: CaptureExplainerKind;
  onContinue: () => void;
  onCancel: () => void;
  cancelLabel: string;
}) {
  const palette = usePalette();
  const [secondsLeft, setSecondsLeft] = useState(CONTINUE_LOCK_SECONDS);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const locked = secondsLeft > 0;

  const handleContinue = async () => {
    if (locked || saving) return;
    setSaving(true);
    try {
      if (dontShowAgain) {
        await setSkipCaptureExplainer(kind, true);
      }
      onContinue();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setDontShowAgain((v) => !v)}
        style={styles.checkboxRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: dontShowAgain }}
        accessibilityLabel="Dont show this again"
        hitSlop={8}
      >
        <Ionicons
          name={dontShowAgain ? 'checkbox' : 'square-outline'}
          size={22}
          color={dontShowAgain ? palette.indigo : palette.textTertiary}
        />
        <AppText variant="small" color={palette.textSecondary} style={styles.checkboxLabel}>
          {"Don't show again"}
        </AppText>
      </Pressable>

      <PillButton
        label={locked ? `Continue (${secondsLeft})` : 'Continue'}
        icon="arrow-forward"
        size="lg"
        fullWidth
        disabled={locked}
        loading={saving}
        onPress={() => void handleContinue()}
      />
      <PillButton
        label={cancelLabel}
        variant="ghost"
        size="lg"
        fullWidth
        onPress={onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: spacing.md },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  checkboxLabel: { flexShrink: 1 },
});
