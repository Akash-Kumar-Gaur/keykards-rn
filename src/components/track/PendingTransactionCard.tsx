/**
 * PendingTransactionBanner — confirm / edit / dismiss a parsed transaction.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { formatInr } from '@/lib/cardUtils';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { VaultTransaction } from '@/types/track';
import type { VaultCard } from '@/types/card';

export function PendingTransactionCard({
  txn,
  cards,
  onConfirm,
  onDismiss,
  loading,
}: {
  txn: VaultTransaction;
  cards: VaultCard[];
  onConfirm: (patch: {
    amount: number;
    merchantRaw: string;
    cardId: string | null;
    transactionDate: string;
  }) => void;
  onDismiss: () => void;
  loading?: boolean;
}) {
  const palette = usePalette();
  const [amount, setAmount] = useState(String(txn.amount));
  const [merchant, setMerchant] = useState(txn.merchantRaw);
  const [date, setDate] = useState(txn.transactionDate);
  const [cardId, setCardId] = useState<string | null>(txn.cardId);
  const [editing, setEditing] = useState(false);

  return (
    <GlassCard style={styles.card} padding={spacing.lg}>
      <AppText variant="caption" color={palette.indigo}>
        {txn.source.toUpperCase()} · {txn.sourceConfidence} confidence
      </AppText>
      <AppText variant="title">
        {txn.transactionType === 'points_credit'
          ? `${txn.pointsAmount ?? 0} points`
          : formatInr(Number(amount) || txn.amount)}
      </AppText>
      <AppText variant="small" color={palette.textSecondary}>
        {merchant || 'Unknown'} · {date}
      </AppText>
      {!cardId ? (
        <AppText variant="caption" color={palette.amber}>
          No card matched — assign one before confirming.
        </AppText>
      ) : null}

      {editing ? (
        <View style={styles.edit}>
          <FloatingLabelField
            label="Amount"
            icon="cash-outline"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <FloatingLabelField
            label="Merchant"
            icon="storefront-outline"
            value={merchant}
            onChangeText={setMerchant}
          />
          <FloatingLabelField
            label="Date"
            icon="calendar-outline"
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />
          <AppText variant="caption" color={palette.textTertiary}>
            Assign card
          </AppText>
          <View style={styles.chips}>
            {cards.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCardId(c.id)}
                style={[
                  styles.chip,
                  { borderColor: palette.glassBorder, backgroundColor: palette.glassFill },
                  cardId === c.id && {
                    backgroundColor: palette.indigo,
                    borderColor: palette.indigo,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color={cardId === c.id ? palette.textOnAccent : palette.textSecondary}
                >
                  {c.nickname} ···{c.lastFour}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PillButton
          label="Confirm"
          size="sm"
          loading={loading}
          onPress={() =>
            onConfirm({
              amount: Number(amount) || txn.amount,
              merchantRaw: merchant.trim() || txn.merchantRaw,
              cardId,
              transactionDate: date.trim() || txn.transactionDate,
            })
          }
        />
        <PillButton
          label={editing ? 'Hide edit' : 'Edit'}
          size="sm"
          variant="ghost"
          onPress={() => setEditing((v) => !v)}
        />
        <PillButton label="Dismiss" size="sm" variant="ghost" onPress={onDismiss} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  edit: { gap: spacing.sm, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
});
