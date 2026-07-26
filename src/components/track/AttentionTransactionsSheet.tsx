/**
 * AttentionTransactionsSheet — unresolved card links (pending_sync / unmatched).
 * Manual assign escape hatch so nothing depends on waiting for a sync event.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { formatInr } from '@/lib/cardUtils';
import type { VaultCard } from '@/types/card';
import type { VaultTransaction } from '@/types/track';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

type Props = {
  visible: boolean;
  items: VaultTransaction[];
  cards: VaultCard[];
  loading?: boolean;
  onClose: () => void;
  onAssign: (txnId: string, cardId: string) => Promise<void> | void;
  onMarkUnmatched: (txnId: string) => Promise<void> | void;
};

export function AttentionTransactionsSheet({
  visible,
  items,
  cards,
  loading,
  onClose,
  onAssign,
  onMarkUnmatched,
}: Props) {
  const palette = usePalette();
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<void> | void) => {
    setBusyId(id);
    try {
      await fn();
      setPickingFor(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <AppText variant="title">Needs attention</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          These transactions are saved but not linked to a card yet. Assign one
          manually, or re-enter the matching card when prompted.
        </AppText>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <AppText variant="small" color={palette.textTertiary} style={styles.empty}>
            No transactions need attention.
          </AppText>
        ) : (
          items.map((t) => {
            const picking = pickingFor === t.id;
            const hint = [
              t.cardHint?.last_four ? `···${t.cardHint.last_four}` : null,
              t.cardHint?.bank_name_guess ?? null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View
                key={t.id}
                style={[styles.row, { borderBottomColor: palette.glassBorder }]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowText}>
                    <AppText variant="bodyLg" numberOfLines={1}>
                      {t.merchantRaw || 'Unknown merchant'}
                    </AppText>
                    <AppText variant="caption" color={palette.textTertiary}>
                      {formatInr(t.amount)} · {t.transactionDate}
                      {hint ? ` · Likely ${hint}` : ''}
                    </AppText>
                    <AppText
                      variant="caption"
                      color={
                        t.linkStatus === 'pending_sync'
                          ? palette.amber
                          : palette.textSecondary
                      }
                    >
                      {t.linkStatus === 'pending_sync'
                        ? 'Waiting until you re-enter this card'
                        : 'Not linked to a card'}
                    </AppText>
                  </View>
                </View>

                {picking ? (
                  <View style={styles.chips}>
                    {cards.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.chip,
                          {
                            borderColor: palette.glassBorder,
                            backgroundColor: palette.glassFill,
                          },
                          c.txnLinkBlocked && styles.chipMuted,
                        ]}
                        disabled={c.txnLinkBlocked || busyId === t.id}
                        onPress={() =>
                          run(t.id, () => onAssign(t.id, c.id))
                        }
                      >
                        <AppText
                          variant="caption"
                          color={
                            c.txnLinkBlocked
                              ? palette.textTertiary
                              : palette.textPrimary
                          }
                        >
                          {c.nickname} ···{c.lastFour}
                          {c.txnLinkBlocked ? ' (re-enter card)' : ''}
                        </AppText>
                      </Pressable>
                    ))}
                    <PillButton
                      label="Cancel"
                      size="sm"
                      variant="ghost"
                      onPress={() => setPickingFor(null)}
                    />
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <PillButton
                      label="Assign to card"
                      size="sm"
                      icon="card-outline"
                      loading={busyId === t.id || loading}
                      onPress={() => setPickingFor(t.id)}
                    />
                    {t.linkStatus === 'pending_sync' ? (
                      <PillButton
                        label="Don’t ask again"
                        size="sm"
                        variant="ghost"
                        icon="close"
                        onPress={() =>
                          run(t.id, () => onMarkUnmatched(t.id))
                        }
                      />
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <PillButton label="Done" variant="ghost" fullWidth onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, marginBottom: spacing.sm },
  list: { maxHeight: 420 },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTop: { flexDirection: 'row', gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipMuted: { opacity: 0.55 },
});
