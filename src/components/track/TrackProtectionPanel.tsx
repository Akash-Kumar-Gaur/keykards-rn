/**
 * TrackProtectionPanel — manual purchase log vs catalog protection wording.
 */

import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { PurchaseDateField } from '@/components/track/PurchaseDateField';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { useAuthStore } from '@/stores/authStore';
import {
  matchPurchaseProtection,
  usePurchaseProtection,
} from '@/hooks/useCatalogFirst';
import { showDialog } from '@/stores/dialogStore';
import { formatInr } from '@/lib/cardUtils';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export function TrackProtectionPanel({ delayBase = 0 }: { delayBase?: number }) {
  const palette = usePalette();
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
    <View style={styles.wrap}>
      <AnimatedEntrance delay={delayBase}>
        <AppText variant="small" color={palette.textSecondary}>
          Log a purchase and we’ll match it against this card’s catalog-listed
          protection / warranty wording — no receipt parsing.
        </AppText>
      </AnimatedEntrance>

      <AnimatedEntrance delay={delayBase + 60}>
        <GlassCard style={styles.form} padding={spacing.lg} elevation="raised">
          <AppText variant="body">Card</AppText>
          <View style={styles.cardPick}>
            {cards.map(({ card }) => {
              const selectedCard = card.id === activeCardId;
              const label =
                card.nickname.length > 28
                  ? `${card.nickname.slice(0, 27)}…`
                  : card.nickname;
              return (
                <PillButton
                  key={card.id}
                  label={label}
                  size="sm"
                  variant={selectedCard ? 'primary' : 'ghost'}
                  onPress={() => setCardId(card.id)}
                />
              );
            })}
          </View>

          {cards.length === 0 ? (
            <AppText variant="small" color={palette.textTertiary}>
              Add a card to look up purchase protection.
            </AppText>
          ) : null}

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
          <PurchaseDateField value={purchaseDate} onChange={setPurchaseDate} />
          <FloatingLabelField
            label="Price (₹)"
            icon="cash-outline"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <PillButton
            label="Log purchase & check cover"
            onPress={onCheck}
            loading={logPurchase.isPending}
            fullWidth
          />
        </GlassCard>
      </AnimatedEntrance>

      {logs.length > 0 ? (
        <AnimatedEntrance delay={delayBase + 120}>
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
        </AnimatedEntrance>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  form: { gap: spacing.md },
  cardPick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  history: { gap: spacing.sm, marginTop: spacing.sm },
  log: { gap: 4 },
});
