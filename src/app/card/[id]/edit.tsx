/**
 * Edit card — re-encrypts PAN/CVV when the user enters new values.
 * After a successful PAN re-entry, surfaces pending_sync transactions that
 * look like they belong to this card for an explicit link confirm.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { CardForm } from '@/components/vault/CardForm';
import {
  ConfirmTransactionsSheet,
  type ConfirmPatch,
} from '@/components/track/ConfirmTransactionsSheet';
import { useAuthStore } from '@/stores/authStore';
import { useCard, useUpdateCard } from '@/hooks/useCards';
import { useDuplicateCardGuard } from '@/hooks/useDuplicateCardGuard';
import {
  fetchPendingSyncForCard,
  useLinkTransaction,
} from '@/hooks/useTransactions';
import {
  confirmItemFromVaultTxn,
  type ConfirmFlowItem,
} from '@/lib/confirmFlowItems';
import { digitsOnly } from '@/lib/cardUtils';
import { logger } from '@/lib/logger';
import { showDialog } from '@/stores/dialogStore';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { CardFormInput } from '@/types/card';

export default function EditCardScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: card, isLoading } = useCard(id);
  const update = useUpdateCard(userId);
  const { confirmNotDuplicate } = useDuplicateCardGuard(userId);
  const linkTxn = useLinkTransaction(userId);
  const [error, setError] = useState<string | null>(null);
  const [reconcileItems, setReconcileItems] = useState<ConfirmFlowItem[]>([]);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const finish = () => router.back();

  const onSubmit = async (input: CardFormInput) => {
    if (!card) return;
    if (!userId) {
      showDialog({
        title: 'Sign in required',
        message: 'Sign in again to save changes to this card.',
        icon: 'log-in-outline',
        tone: 'amber',
        actions: [{ label: 'Got it', variant: 'primary' }],
      });
      return;
    }
    setError(null);

    // Only warns about OTHER cards — `excludeCardId` keeps a card from ever
    // matching itself. A blank number on edit keeps the stored last four.
    const proceed = await confirmNotDuplicate(input, {
      excludeCardId: card.id,
      fallbackLastFour: card.lastFour,
    });
    if (!proceed) return;

    try {
      const updated = await update.mutateAsync({
        cardId: card.id,
        input,
        existing: card,
      });

      const panEntered = digitsOnly(input.cardNumber).length > 0;
      if (!panEntered) {
        finish();
        return;
      }

      // Card is freshly synced — offer to attach any pending_sync matches.
      const pending = await fetchPendingSyncForCard({
        userId,
        lastFour: updated.lastFour,
        bankName: updated.bankName,
      });
      if (pending.length === 0) {
        finish();
        return;
      }

      showDialog({
        title:
          pending.length === 1
            ? '1 transaction looks like it belongs here'
            : `${pending.length} transactions from before this card was synced look like they belong here`,
        message: 'Review each one to add it to this card, or skip.',
        icon: 'link-outline',
        tone: 'indigo',
        actions: [
          {
            label: 'Not now',
            variant: 'ghost',
            onPress: finish,
          },
          {
            label: 'Review',
            variant: 'primary',
            onPress: () => {
              setReconcileItems(pending.map(confirmItemFromVaultTxn));
              setReconcileOpen(true);
            },
          },
        ],
      });
    } catch (err) {
      logger.warn('Update card failed', err);
      const message =
        err instanceof Error ? err.message : 'Could not save changes.';
      setError(message);
      showDialog({
        title: 'Couldn’t save changes',
        message,
        icon: 'alert-circle-outline',
        tone: 'amber',
        actions: [{ label: 'Got it', variant: 'primary' }],
      });
    }
  };

  const onReconcileConfirm = async (
    item: ConfirmFlowItem,
    _patch: ConfirmPatch,
  ) => {
    if (!card || !item.vaultId) return;
    await linkTxn.mutateAsync({
      id: item.vaultId,
      cardId: card.id,
      linkStatus: 'linked',
    });
  };

  const onReconcileDismiss = async (item: ConfirmFlowItem) => {
    if (!item.vaultId) return;
    await linkTxn.mutateAsync({
      id: item.vaultId,
      cardId: null,
      linkStatus: 'unmatched',
    });
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
          <AppText variant="h2">Edit card</AppText>
        </View>
      </View>

      {isLoading || !card ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.indigo} />
        </View>
      ) : (
        <>
          {error ? (
            <AppText variant="small" color={palette.amber} style={styles.error}>
              {error}
            </AppText>
          ) : null}
          {card.txnLinkBlocked ? (
            <AppText variant="small" color={palette.amber} style={styles.error}>
              Re-enter the card number to secure it with this device’s key. Any
              transactions waiting for this card will then be offered for linking.
            </AppText>
          ) : null}
          <CardForm
            mode="edit"
            userId={userId}
            excludeCardId={card.id}
            initial={card}
            loading={update.isPending}
            onSubmit={onSubmit}
            onCancel={() => router.back()}
          />
        </>
      )}

      <ConfirmTransactionsSheet
        visible={reconcileOpen}
        items={reconcileItems}
        cards={card ? [card] : []}
        loading={linkTxn.isPending}
        onClose={() => {
          setReconcileOpen(false);
          setReconcileItems([]);
          finish();
        }}
        onConfirm={onReconcileConfirm}
        onDismiss={onReconcileDismiss}
        onComplete={finish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  back: { padding: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
});
