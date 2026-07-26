/**
 * ConfirmTransactionsSheet — content-sized bottom sheet for reviewing a fixed
 * batch of parsed transactions. Index uses originalBatchSize (not shrinking
 * queue length). Items resolve optimistically in local state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { IconBadge } from '@/components/ui/IconBadge';
import { CountUpText } from '@/components/ui/CountUpText';
import { merchantCategoryMeta } from '@/lib/merchantCategoryMeta';
import { formatInr } from '@/lib/cardUtils';
import { getCardTheme, suggestThemeForBank } from '@/lib/cardThemes';
import type { ConfirmFlowItem } from '@/lib/confirmFlowItems';
import type { VaultCard } from '@/types/card';
import { radius, spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type ConfirmPatch = {
  amount: number;
  merchantRaw: string;
  cardId: string | null;
  transactionDate: string;
};

type Props = {
  visible: boolean;
  items: ConfirmFlowItem[];
  cards: VaultCard[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (item: ConfirmFlowItem, patch: ConfirmPatch) => Promise<void> | void;
  onDismiss: (item: ConfirmFlowItem) => Promise<void> | void;
  onComplete?: () => void;
  /** Called once when a batch session starts (items captured). */
  onBatchStart?: (items: ConfirmFlowItem[]) => void;
};

function bankAccent(bankName: string): string {
  const themeId = suggestThemeForBank(bankName) ?? 'generic-violet';
  return getCardTheme(themeId).colors[0];
}

function ConfidenceDot({ level }: { level: ConfirmFlowItem['sourceConfidence'] }) {
  const palette = usePalette();
  if (level === 'high') return null;
  const color = level === 'medium' ? palette.amber : palette.textTertiary;
  return (
    <View style={styles.confRow}>
      <View style={[styles.confDot, { backgroundColor: color }]} />
      <AppText variant="caption" color={color}>
        {level === 'medium' ? 'Review suggested' : 'Low confidence'}
      </AppText>
    </View>
  );
}

/** Amber flag matching the low-confidence treatment; requires an explicit call. */
function DuplicateBadge({ dup }: { dup: NonNullable<ConfirmFlowItem['duplicateOf']> }) {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.dupBadge,
        { borderColor: palette.amber, backgroundColor: palette.amberSoft },
      ]}
    >
      <View style={styles.dupHead}>
        <Ionicons name="copy-outline" size={14} color={palette.amber} />
        <AppText variant="caption" color={palette.amber}>
          Possible duplicate
        </AppText>
      </View>
      <AppText variant="caption" color={palette.textSecondary}>
        Matches {formatInr(dup.amount)} on {dup.transactionDate}
        {dup.status === 'pending' ? ' (awaiting review)' : ''}
      </AppText>
    </View>
  );
}

function SuccessBurst({ visible }: { visible: boolean }) {
  const palette = usePalette();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0;
      opacity.value = 0;
      return;
    }
    opacity.value = withTiming(1, { duration: 120 });
    scale.value = withSequence(
      withSpring(1.15, { damping: 10, stiffness: 220 }),
      withSpring(1, motion.springConfig),
      withDelay(420, withTiming(0.9, { duration: 180 })),
    );
    opacity.value = withDelay(520, withTiming(0, { duration: 220 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;
  return (
    <Animated.View style={[styles.burst, style]} pointerEvents="none">
      <View style={[styles.burstCircle, { backgroundColor: palette.green }]}>
        <Ionicons name="checkmark" size={36} color={palette.textOnAccent} />
      </View>
      <AppText variant="small" color={palette.green}>
        All set
      </AppText>
    </Animated.View>
  );
}

function TxnCard({
  item,
  cards,
  loading,
  onConfirm,
  onDismiss,
}: {
  item: ConfirmFlowItem;
  cards: VaultCard[];
  loading?: boolean;
  onConfirm: (patch: ConfirmPatch) => void;
  onDismiss: () => void;
}) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const enter = useSharedValue(0.92);
  const iconPop = useSharedValue(0.7);

  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(item.amount));
  const [merchant, setMerchant] = useState(item.merchantRaw);
  const [date, setDate] = useState(item.transactionDate);
  const [cardId, setCardId] = useState<string | null>(item.suggestedCardId);

  useEffect(() => {
    setAmount(String(item.amount));
    setMerchant(item.merchantRaw);
    setDate(item.transactionDate);
    setCardId(item.suggestedCardId);
    setEditing(false);
  }, [item.key, item.amount, item.merchantRaw, item.transactionDate, item.suggestedCardId]);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      iconPop.value = 1;
      return;
    }
    enter.value = withSpring(1, { damping: 14, stiffness: 200, mass: 0.85 });
    iconPop.value = withSequence(
      withTiming(0.7, { duration: 40 }),
      withSpring(1.12, { damping: 10, stiffness: 260 }),
      withSpring(1, motion.springConfig),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key, reduced]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + enter.value * 0.45,
    transform: [{ scale: enter.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPop.value }],
  }));

  const matched = cardId ? cards.find((c) => c.id === cardId) : undefined;
  const accent = matched
    ? bankAccent(matched.bankName)
    : item.bankHint
      ? bankAccent(item.bankHint)
      : palette.indigo;
  const cat = merchantCategoryMeta(merchant || item.merchantRaw, item.transactionType);

  const amountLabel =
    item.transactionType === 'points_credit'
      ? `${item.pointsAmount ?? 0} pts`
      : formatInr(Number(amount) || item.amount);

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <View style={styles.cardTop}>
        <Animated.View style={iconStyle}>
          <IconBadge icon={cat.icon} tone={cat.tone} size={44} />
        </Animated.View>
        <ConfidenceDot level={item.sourceConfidence} />
      </View>

      {item.duplicateOf ? <DuplicateBadge dup={item.duplicateOf} /> : null}

      {matched?.txnLinkBlocked || item.cardNeedsRefresh ? (
        <View
          style={[
            styles.syncBadge,
            { borderColor: palette.amber, backgroundColor: palette.amberSoft },
          ]}
        >
          <Ionicons name="key-outline" size={14} color={palette.amber} />
          <AppText variant="caption" color={palette.amber} style={{ flex: 1 }}>
            Re-enter this card number to link — confirm will stay unassigned until
            then
          </AppText>
        </View>
      ) : null}

      <AppText variant="title" numberOfLines={2}>
        {merchant || 'Unknown merchant'}
      </AppText>

      <CountUpText
        key={item.key}
        value={amountLabel}
        variant="h1"
        duration={520}
        delay={40}
      />

      <Pressable
        onPress={() => setEditing(true)}
        style={[
          styles.cardMatch,
          { borderColor: accent, backgroundColor: palette.glassFill },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <AppText variant="small" color={matched ? palette.textPrimary : palette.amber}>
          {matched
            ? `${matched.nickname} ···${matched.lastFour}`
            : item.cardLastFour
              ? `···${item.cardLastFour} — tap to assign`
              : 'No card linked — tap to assign'}
        </AppText>
      </Pressable>

      <AppText variant="caption" color={palette.textTertiary}>
        {date}
      </AppText>

      {editing ? (
        <View style={styles.edit}>
          {item.transactionType !== 'points_credit' ? (
            <FloatingLabelField
              label="Amount"
              icon="cash-outline"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          ) : null}
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
                  {
                    borderColor: palette.glassBorder,
                    backgroundColor: palette.glassFill,
                  },
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
          label={item.duplicateOf ? 'Add anyway' : 'Confirm'}
          size="sm"
          icon={item.duplicateOf ? 'add' : 'checkmark'}
          loading={loading}
          onPress={() =>
            onConfirm({
              amount: Number(amount) || item.amount,
              merchantRaw: merchant.trim() || item.merchantRaw,
              cardId,
              transactionDate: date.trim() || item.transactionDate,
            })
          }
        />
        <PillButton
          label={editing ? 'Done' : 'Edit'}
          size="sm"
          variant="ghost"
          icon="create-outline"
          onPress={() => setEditing((v) => !v)}
        />
        <PillButton
          label={item.duplicateOf ? 'Skip' : 'Dismiss'}
          size="sm"
          variant="ghost"
          icon="close"
          onPress={onDismiss}
        />
      </View>
    </Animated.View>
  );
}

function nextUnresolvedIndex(
  batch: ConfirmFlowItem[],
  resolved: Set<string>,
  from: number,
): number {
  for (let i = Math.max(0, from); i < batch.length; i++) {
    if (!resolved.has(batch[i].key)) return i;
  }
  return -1;
}

export function ConfirmTransactionsSheet({
  visible,
  items: inputItems,
  cards,
  loading,
  onClose,
  onConfirm,
  onDismiss,
  onComplete,
  onBatchStart,
}: Props) {
  const palette = usePalette();
  const [batch, setBatch] = useState<ConfirmFlowItem[]>([]);
  const [originalBatchSize, setOriginalBatchSize] = useState(0);
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const sessionOpen = useRef(false);
  const finishing = useRef(false);

  // Capture batch ONCE when the sheet opens — never reset from props mid-session.
  useEffect(() => {
    if (visible && !sessionOpen.current && inputItems.length > 0) {
      sessionOpen.current = true;
      finishing.current = false;
      setBatch(inputItems);
      setOriginalBatchSize(inputItems.length);
      setResolved(new Set());
      setCursor(0);
      setShowBurst(false);
      onBatchStart?.(inputItems);
    }
    if (!visible && sessionOpen.current) {
      sessionOpen.current = false;
    }
    // intentionally omit inputItems — mid-session prop changes must not reset the batch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const currentItem = useMemo(() => {
    const idx = nextUnresolvedIndex(batch, resolved, cursor);
    if (idx < 0) return null;
    return batch[idx];
  }, [batch, resolved, cursor]);

  const displayOrdinal = Math.min(resolved.size + 1, Math.max(originalBatchSize, 1));

  // Duplicate-flagged items always need an individual call, so they are never
  // part of the bulk action even when the user is confirming everything else.
  const batchEligible = useCallback(
    (i: ConfirmFlowItem) =>
      !resolved.has(i.key) && i.sourceConfidence === 'high' && !i.duplicateOf,
    [resolved],
  );
  const highRemaining = useMemo(
    () => batch.filter(batchEligible).length,
    [batch, batchEligible],
  );
  const flaggedRemaining = useMemo(
    () => batch.filter((i) => !resolved.has(i.key) && Boolean(i.duplicateOf)).length,
    [batch, resolved],
  );

  const finishBatch = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    setShowBurst(true);
    setTimeout(() => {
      setShowBurst(false);
      onComplete?.();
      onClose();
    }, 700);
  }, [onClose, onComplete]);

  const markResolvedAndAdvance = useCallback(
    (key: string) => {
      const next = new Set(resolved);
      next.add(key);
      setResolved(next);
      const nextIdx = nextUnresolvedIndex(batch, next, cursor);
      if (nextIdx < 0) {
        finishBatch();
      } else {
        setCursor(nextIdx);
      }
    },
    [batch, cursor, finishBatch, resolved],
  );

  const handleConfirm = async (item: ConfirmFlowItem, patch: ConfirmPatch) => {
    // Resolve locally FIRST so the item cannot reappear if props/remount race.
    markResolvedAndAdvance(item.key);
    setBusy(true);
    try {
      await onConfirm(item, patch);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async (item: ConfirmFlowItem) => {
    markResolvedAndAdvance(item.key);
    setBusy(true);
    try {
      await onDismiss(item);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAllHigh = async () => {
    const highs = batch.filter(batchEligible);
    if (highs.length === 0) return;
    setBusy(true);
    try {
      const nextResolved = new Set(resolved);
      for (const item of highs) {
        nextResolved.add(item.key);
        await onConfirm(item, {
          amount: item.amount,
          merchantRaw: item.merchantRaw,
          cardId: item.suggestedCardId,
          transactionDate: item.transactionDate,
        });
      }
      setResolved(nextResolved);
      const nextIdx = nextUnresolvedIndex(batch, nextResolved, 0);
      if (nextIdx < 0) {
        finishBatch();
      } else {
        setCursor(nextIdx);
      }
    } finally {
      setBusy(false);
    }
  };

  const sheetVisible = visible && (Boolean(currentItem) || showBurst);

  return (
    <BottomSheet visible={sheetVisible} onClose={onClose}>
      <View style={styles.sheetInner}>
        {currentItem && originalBatchSize > 0 ? (
          <>
            <View style={styles.header}>
              <AppText variant="caption" color={palette.textTertiary}>
                {displayOrdinal} of {originalBatchSize}
              </AppText>
              <View style={styles.dots}>
                {batch.map((q, i) => {
                  const done = resolved.has(q.key);
                  const active = q.key === currentItem.key;
                  return (
                    <View
                      key={q.key}
                      style={[
                        styles.dot,
                        { backgroundColor: palette.glassBorderStrong },
                        done && { backgroundColor: palette.green },
                        active && { backgroundColor: palette.indigo, width: 16 },
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            <TxnCard
              key={currentItem.key}
              item={currentItem}
              cards={cards}
              loading={busy || loading}
              onConfirm={(patch) => handleConfirm(currentItem, patch)}
              onDismiss={() => handleDismiss(currentItem)}
            />

            {highRemaining >= 1 &&
            batch.filter((i) => !resolved.has(i.key)).length > 1 ? (
              <View style={styles.batchAction}>
                <PillButton
                  label={`Confirm all (${highRemaining} high-confidence)`}
                  variant="ghost"
                  size="sm"
                  icon="checkmark-done"
                  loading={busy || loading}
                  onPress={handleConfirmAllHigh}
                />
                {flaggedRemaining > 0 ? (
                  <AppText variant="caption" color={palette.amber}>
                    {flaggedRemaining} possible duplicate
                    {flaggedRemaining === 1 ? '' : 's'} excluded — review each one
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <SuccessBurst visible={showBurst} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetInner: {
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  card: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dupBadge: {
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  batchAction: { gap: spacing.xs, alignItems: 'center' },
  cardMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  edit: { gap: spacing.sm, marginTop: spacing.xs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  burst: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  burstCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
