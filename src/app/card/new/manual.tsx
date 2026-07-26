/**
 * Add card — manual entry form. Also consumes ephemeral NFC/scan capture.
 * Auth is required by `card/_layout`; save failures always surface a themed dialog.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { CardForm } from '@/components/vault/CardForm';
import { useAuthStore } from '@/stores/authStore';
import { useCardCaptureStore } from '@/stores/cardCaptureStore';
import { useCreateCard } from '@/hooks/useCards';
import { useDuplicateCardGuard } from '@/hooks/useDuplicateCardGuard';
import { suggestedCardholderName } from '@/lib/cardholderName';
import { supabase } from '@/lib/supabase';
import { showDialog } from '@/stores/dialogStore';
import { logger } from '@/lib/logger';
import { AUTH_REASONS } from '@/lib/requireAuth';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { CardFormInput, CardNetwork } from '@/types/card';
import { CARD_NETWORKS } from '@/types/card';

function asNetwork(hint: string | null | undefined): CardNetwork | null {
  if (!hint) return null;
  return (CARD_NETWORKS as readonly string[]).includes(hint)
    ? (hint as CardNetwork)
    : null;
}

export default function ManualNewCardScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const create = useCreateCard(userId);
  const { confirmNotDuplicate } = useDuplicateCardGuard(userId);
  const takeCapture = useCardCaptureStore((s) => s.takeCapture);
  const [error, setError] = useState<string | null>(null);
  const [capture] = useState(() => takeCapture());
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const profileSuggestion = suggestedCardholderName(user, profileDisplayName);

  useEffect(() => {
    return () => {
      useCardCaptureStore.getState().clear();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const name =
          typeof data?.display_name === 'string' ? data.display_name.trim() : '';
        setProfileDisplayName(name || null);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const onSubmit = async (input: CardFormInput) => {
    setError(null);
    if (!userId) {
      showDialog({
        title: 'Sign in required',
        message: AUTH_REASONS.addCard,
        icon: 'log-in-outline',
        tone: 'amber',
        actions: [
          { label: 'Cancel', variant: 'ghost' },
          {
            label: 'Sign in',
            variant: 'primary',
            onPress: () =>
              router.replace(
                `/sign-in?mode=signUp&reason=${encodeURIComponent(AUTH_REASONS.addCard)}` as Href,
              ),
          },
        ],
      });
      return;
    }
    // Checked before encrypt/upload — plaintext metadata only.
    const proceed = await confirmNotDuplicate(input);
    if (!proceed) return;

    try {
      const card = await create.mutateAsync(input);
      router.replace(`/card/${card.id}/extras` as Href);
    } catch (err) {
      logger.warn('Create card failed', err);
      const message =
        err instanceof Error ? err.message : 'Could not save this card. Please try again.';
      setError(message);
      showDialog({
        title: 'Couldn’t save card',
        message,
        icon: 'alert-circle-outline',
        tone: 'amber',
        actions: [{ label: 'Got it', variant: 'primary' }],
      });
    }
  };

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View>
          <Eyebrow color={palette.indigo}>Vault</Eyebrow>
          <AppText variant="h2">Add card</AppText>
        </View>
      </View>
      {error ? (
        <AppText variant="small" color={palette.amber} style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <CardForm
        mode="create"
        userId={userId}
        loading={create.isPending}
        onSubmit={onSubmit}
        onCancel={() => router.back()}
        scannedCardNumber={capture?.panDigits || null}
        scannedExpiryMonth={capture?.expiryMonth ?? null}
        scannedExpiryYear={capture?.expiryYear ?? null}
        scannedNetwork={asNetwork(capture?.networkHint)}
        scannedCardholderName={capture?.cardholderName ?? null}
        suggestedCardholderName={profileSuggestion}
        captureNotice={capture?.notice ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
});
