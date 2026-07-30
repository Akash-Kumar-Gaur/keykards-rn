/**
 * Purchase protection lookup — manual purchase log vs catalog terms.
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { useAuthStore } from '@/stores/authStore';
import {
  matchPurchaseProtection,
  usePurchaseProtection,
} from '@/hooks/useCatalogFirst';
import { showDialog } from '@/stores/dialogStore';
import { formatInr } from '@/lib/cardUtils';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function PurchaseProtectionScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { cards, logs, logPurchase } = usePurchaseProtection(userId);

  const [cardId, setCardId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [price, setPrice] = useState('');

  const selected = cards.find((c) => c.card.id === cardId) ?? cards[0];
  const activeCardId = cardId ?? selected?.card.id ?? null;
  const matches = useMemo(
    () => matchPurchaseProtection(selected?.benefits ?? []),
    [selected],
  );

  const onCheck = async () => {
    if (!activeCardId) {
      showDialog({
        title: 'Pick a card',
        message: 'Add a card first, then check purchase protection.',
        tone: 'amber',
      });
      return;
    }
    const amount = Number(price.replace(/,/g, ''));
    if (!itemName.trim() || !Number.isFinite(amount) || amount < 0) {
      showDialog({
        title: 'Missing details',
        message: 'Enter an item name and a valid price.',
        tone: 'amber',
      });
      return;
    }
    try {
      const result = await logPurchase.mutateAsync({
        cardId: activeCardId,
        itemName,
        purchaseDate,
        price: amount,
      });
      if (result.matches.length === 0) {
        showDialog({
          title: 'No matching cover found',
          message:
            'This card’s benefits don’t list purchase protection or extended warranty in catalog text. Check your bank’s terms to be sure.',
          tone: 'amber',
        });
      } else {
        const m = result.matches[0]!;
        showDialog({
          title: 'Possible cover',
          message: `${m.title}\n\n${m.description.slice(0, 280)}${
            m.description.length > 280 ? '…' : ''
          }`,
          tone: 'green',
        });
      }
      setItemName('');
      setPrice('');
    } catch {
      showDialog({
        title: 'Could not save',
        message: 'Try again in a moment.',
        tone: 'danger',
      });
    }
  };

  return (
    <View style={styles.root}>
      <GlowBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.huge,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <PillButton
          label="Back"
          variant="ghost"
          size="sm"
          icon="chevron-back"
          onPress={() => router.back()}
        />
        <Eyebrow color={palette.indigo}>Manual lookup</Eyebrow>
        <AppText variant="h1">Purchase protection</AppText>
        <AppText variant="small" color={palette.textSecondary}>
          Log a purchase and we’ll match it against this card’s catalog-listed
          protection / warranty wording — no receipt parsing.
        </AppText>

        <GlassCard style={styles.form} padding={spacing.lg}>
          <AppText variant="body">Card</AppText>
          <View style={styles.cardPick}>
            {cards.map(({ card }) => {
              const selectedCard = card.id === activeCardId;
              return (
                <PillButton
                  key={card.id}
                  label={
                    card.nickname.length > 28
                      ? `${card.nickname.slice(0, 27)}…`
                      : card.nickname
                  }
                  size="sm"
                  variant={selectedCard ? 'primary' : 'ghost'}
                  onPress={() => setCardId(card.id)}
                />
              );
            })}
          </View>

          {matches.length > 0 ? (
            <AppText variant="small" color={palette.green}>
              {matches.length} protection-related benefit
              {matches.length === 1 ? '' : 's'} on this card
            </AppText>
          ) : selected ? (
            <AppText variant="small" color={palette.amber}>
              No purchase-protection wording found on this card’s benefits
            </AppText>
          ) : null}

          <FloatingLabelField
            label="Item name"
            icon="cube-outline"
            value={itemName}
            onChangeText={setItemName}
          />
          <FloatingLabelField
            label="Purchase date (YYYY-MM-DD)"
            icon="calendar-outline"
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            autoCapitalize="none"
          />
          <FloatingLabelField
            label="Price (₹)"
            icon="cash-outline"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <PillButton
            label="Check cover"
            onPress={onCheck}
            loading={logPurchase.isPending}
            fullWidth
          />
        </GlassCard>

        {logs.length > 0 ? (
          <View style={styles.history}>
            <AppText variant="title">Recent lookups</AppText>
            {logs.map((log: Record<string, unknown>) => (
              <GlassCard key={String(log.id)} padding={spacing.md} style={styles.log}>
                <AppText variant="body">{String(log.item_name)}</AppText>
                <AppText variant="small" color={palette.textSecondary}>
                  {formatInr(Number(log.price) || 0)} · {String(log.purchase_date)}
                </AppText>
                {log.matched_benefit_title ? (
                  <AppText variant="caption" color={palette.green}>
                    Matched: {String(log.matched_benefit_title)}
                  </AppText>
                ) : (
                  <AppText variant="caption" color={palette.textTertiary}>
                    No catalog match
                  </AppText>
                )}
              </GlassCard>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  form: { gap: spacing.md },
  cardPick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  history: { gap: spacing.sm, marginTop: spacing.md },
  log: { gap: 4 },
});
