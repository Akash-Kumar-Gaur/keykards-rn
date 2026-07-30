/**
 * Track tab — Checklist / Calendar / Protection segments.
 * Catalog-first baseline on Checklist; imports stay optional.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { GlassCard } from '@/components/ui/GlassCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ScrollRevealProvider } from '@/components/ui/ScrollReveal';
import {
  ConfirmTransactionsSheet,
  type ConfirmPatch,
} from '@/components/track/ConfirmTransactionsSheet';
import { AttentionTransactionsSheet } from '@/components/track/AttentionTransactionsSheet';
import {
  ParsingStatusPill,
  withMinDuration,
  type ParsingPillState,
} from '@/components/track/ParsingStatusPill';
import { MilestoneResetNoticeBanner } from '@/components/card/MilestoneResetNoticeBanner';
import { TrackThemeProvider } from '@/components/track/TrackTheme';
import { TrackChecklistPanel } from '@/components/track/TrackChecklistPanel';
import { TrackCalendarPanel } from '@/components/track/TrackCalendarPanel';
import { TrackProtectionPanel } from '@/components/track/TrackProtectionPanel';
import { readClipboardTransactionCandidate } from '@/adapters/clipboardAdapter';
import { parseOcrExtractedText } from '@/adapters/ocrAdapter';
import {
  confirmItemFromParse,
  confirmItemFromVaultTxn,
  toParsedTransaction,
  type ConfirmFlowItem,
} from '@/lib/confirmFlowItems';
import { findDuplicatesForDrafts } from '@/lib/transactionDedupe';
import { resolveLinkDecision } from '@/lib/transactionLinking';
import {
  accentPairFromThemeId,
  defaultTrackAccent,
  filterTrackSnapshot,
} from '@/lib/trackAccent';
import { useAuthStore } from '@/stores/authStore';
import { useTrackScopeStore } from '@/stores/trackScopeStore';
import { useRequireAuth } from '@/lib/requireAuth';
import { useCards } from '@/hooks/useCards';
import { useTrackSnapshot } from '@/hooks/useTrackData';
import {
  useAutoFinalizePending,
  useAttentionTransactions,
  useConfirmTransaction,
  useDismissTransaction,
  useIngestParsedTransaction,
  useLinkTransaction,
  usePendingTransactions,
} from '@/hooks/useTransactions';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useClipboardProcessedStore } from '@/stores/clipboardProcessedStore';
import type { CardColorTheme } from '@/types/card';
import * as Clipboard from 'expo-clipboard';

type TrackSegment = 'checklist' | 'calendar' | 'protection';

const SEGMENTS: { id: TrackSegment; label: string; icon: 'list-outline' | 'calendar-outline' | 'shield-checkmark-outline' }[] = [
  { id: 'checklist', label: 'Checklist', icon: 'list-outline' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
  { id: 'protection', label: 'Protection', icon: 'shield-checkmark-outline' },
];

function SegmentBody({
  segment,
  children,
}: {
  segment: TrackSegment;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = reduced
      ? 1
      : withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * (reduced ? 0 : 10) }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function TrackScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const requireAuth = useRequireAuth();
  const { data: cards = [] } = useCards(userId);
  const { data: snapshot, isLoading, refetch } = useTrackSnapshot(userId);
  const { data: pending = [] } = usePendingTransactions(userId);
  const { data: attention = [] } = useAttentionTransactions(userId);
  const ingest = useIngestParsedTransaction();
  const confirm = useConfirmTransaction(userId);
  const dismiss = useDismissTransaction(userId);
  const linkTxn = useLinkTransaction(userId);
  const autoFinalize = useAutoFinalizePending(userId);

  const selectedCardId = useTrackScopeStore((s) => s.selectedCardId);
  const setSelectedCardId = useTrackScopeStore((s) => s.setSelectedCardId);

  const clipboardReady = useClipboardProcessedStore((s) => s.ready);
  const initClipboardHash = useClipboardProcessedStore((s) => s.init);
  const markClipboardProcessed = useClipboardProcessedStore((s) => s.markProcessed);
  const isClipboardProcessed = useClipboardProcessedStore((s) => s.isAlreadyProcessed);

  const [segment, setSegment] = useState<TrackSegment>('checklist');
  const [clipboardHint, setClipboardHint] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [showOcr, setShowOcr] = useState(false);
  const [parsingState, setParsingState] = useState<ParsingPillState>(null);
  const [confirmItems, setConfirmItems] = useState<ConfirmFlowItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const openedPendingIds = useRef<Set<string>>(new Set());
  const clipboardBatchRaw = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedCardId) return;
    if (!cards.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [cards, selectedCardId, setSelectedCardId]);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  const accentPair = useMemo(
    () =>
      selectedCard
        ? accentPairFromThemeId(selectedCard.cardColorTheme, palette)
        : defaultTrackAccent(palette),
    [selectedCard, palette],
  );

  const themeByCardId = useMemo(() => {
    const map: Record<string, CardColorTheme> = {};
    for (const c of cards) map[c.id] = c.cardColorTheme;
    return map;
  }, [cards]);

  const scopedSnapshot = useMemo(
    () => (snapshot ? filterTrackSnapshot(snapshot, selectedCardId) : snapshot),
    [snapshot, selectedCardId],
  );

  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const matchCtx = useMemo(
    () => ({
      cards: cards.map((c) => ({
        id: c.id,
        lastFour: c.lastFour,
        bankName: c.bankName,
      })),
    }),
    [cards],
  );

  const withDuplicateFlags = useCallback(
    async (items: ConfirmFlowItem[]): Promise<ConfirmFlowItem[]> => {
      if (!userId || items.length === 0) return items;
      const withSync = items.map((i) => {
        const suggested = i.suggestedCardId
          ? cards.find((c) => c.id === i.suggestedCardId)
          : undefined;
        return {
          ...i,
          cardNeedsRefresh: Boolean(suggested?.txnLinkBlocked),
        };
      });
      try {
        const dups = await findDuplicatesForDrafts({
          userId,
          drafts: withSync.map((i) => ({
            key: i.key,
            cardId: i.suggestedCardId,
            amount: i.amount,
            transactionDate: i.transactionDate,
            merchantNormalized: i.merchantNormalized,
          })),
        });
        if (Object.keys(dups).length === 0) return withSync;
        return withSync.map((i) =>
          dups[i.key] && dups[i.key].id !== i.vaultId
            ? { ...i, duplicateOf: dups[i.key] }
            : i,
        );
      } catch {
        return withSync;
      }
    },
    [userId, cards],
  );

  useEffect(() => {
    if (userId) autoFinalize.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    initClipboardHash();
  }, [initClipboardHash]);

  useEffect(() => {
    if (sheetOpen || parsingState || pending.length === 0) return;
    const fresh = pending.filter((p) => !openedPendingIds.current.has(p.id));
    if (fresh.length === 0) return;
    fresh.forEach((p) => openedPendingIds.current.add(p.id));
    let cancelled = false;
    (async () => {
      const items = await withDuplicateFlags(fresh.map(confirmItemFromVaultTxn));
      if (cancelled) return;
      setConfirmItems(items);
      setSheetOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, sheetOpen, parsingState, withDuplicateFlags]);

  const scanClipboard = useCallback(async () => {
    if (!userId || !clipboardReady) return;
    try {
      const raw = (await Clipboard.getStringAsync())?.trim() ?? '';
      if (!raw || isClipboardProcessed(raw)) {
        setClipboardHint(null);
        return;
      }
      const candidate = await readClipboardTransactionCandidate(matchCtx);
      if (!candidate?.parses.length) {
        setClipboardHint(null);
        return;
      }
      if (isClipboardProcessed(candidate.rawText)) {
        setClipboardHint(null);
        return;
      }
      const n = candidate.parses.length;
      setClipboardHint(
        n === 1
          ? `Transaction detected · ${candidate.parses[0].parsed!.merchantRaw}`
          : `${n} transactions detected on clipboard`,
      );
    } catch {
      setClipboardHint(null);
    }
  }, [userId, matchCtx, clipboardReady, isClipboardProcessed]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scanClipboard();
    });
    scanClipboard();
    return () => sub.remove();
  }, [scanClipboard]);

  const openConfirmSheet = async (items: ConfirmFlowItem[], rawText?: string) => {
    if (items.length === 0) return;
    clipboardBatchRaw.current = rawText ?? items[0]?.rawText ?? null;
    setConfirmItems(await withDuplicateFlags(items));
    setSheetOpen(true);
  };

  const showEmptyPill = () => {
    setParsingState('empty');
    setTimeout(() => setParsingState(null), 900);
  };

  const importClipboard = async () => {
    if (!requireAuth({ message: 'Sign in to import transactions' })) return;
    if (!userId) return;
    try {
      const rawPeek = (await Clipboard.getStringAsync())?.trim() ?? '';
      if (rawPeek && isClipboardProcessed(rawPeek)) {
        setClipboardHint(null);
        setParsingState('empty');
        setTimeout(() => setParsingState(null), 900);
        return;
      }
    } catch {
      /* continue */
    }

    setParsingState('reading');
    try {
      const candidate = await withMinDuration(
        readClipboardTransactionCandidate(matchCtx),
      );
      if (!candidate?.parses.length) {
        showEmptyPill();
        return;
      }
      if (isClipboardProcessed(candidate.rawText)) {
        setParsingState(null);
        setClipboardHint(null);
        return;
      }
      setParsingState(null);
      setClipboardHint(null);
      await openConfirmSheet(
        candidate.parses.map((parse, i) =>
          confirmItemFromParse({
            key: `clipboard-${Date.now()}-${i}`,
            parse: { parsed: parse.parsed!, suggestedCardId: parse.suggestedCardId },
            source: 'clipboard',
            rawText: candidate.rawText,
          }),
        ),
        candidate.rawText,
      );
    } catch {
      showEmptyPill();
    }
  };

  const importOcrText = async () => {
    if (!requireAuth({ message: 'Sign in to import transactions' })) return;
    if (!userId || !ocrText.trim()) return;
    setParsingState('reading');
    try {
      const out = await withMinDuration(
        Promise.resolve(
          parseOcrExtractedText({ extractedText: ocrText, ctx: matchCtx }, true),
        ),
      );
      if (!out.parses.length) {
        showEmptyPill();
        return;
      }
      setParsingState(null);
      setOcrText('');
      setShowOcr(false);
      await openConfirmSheet(
        out.parses.map((parse, i) =>
          confirmItemFromParse({
            key: `ocr-${Date.now()}-${i}`,
            parse: { parsed: parse.parsed!, suggestedCardId: parse.suggestedCardId },
            source: 'ocr',
            rawText: out.rawText,
          }),
        ),
      );
    } catch {
      showEmptyPill();
    }
  };

  const handleConfirmItem = async (item: ConfirmFlowItem, patch: ConfirmPatch) => {
    if (!userId) return;

    const selected = patch.cardId
      ? cards.find((c) => c.id === patch.cardId) ?? null
      : null;
    const link = resolveLinkDecision({
      selectedCardId: patch.cardId,
      selectedCard: selected
        ? {
            id: selected.id,
            lastFour: selected.lastFour,
            bankName: selected.bankName,
            txnLinkBlocked: selected.txnLinkBlocked,
          }
        : null,
      parseLastFour: item.cardLastFour,
      parseBankHint: item.bankHint,
    });

    if (item.vaultId) {
      await confirm.mutateAsync({
        id: item.vaultId,
        amount: patch.amount,
        merchantRaw: patch.merchantRaw,
        cardId: link.cardId,
        transactionDate: patch.transactionDate,
        linkStatus: link.linkStatus,
        cardHint: link.cardHint,
      });
      return;
    }
    const parsed = {
      ...toParsedTransaction(item),
      amount: patch.amount,
      merchantRaw: patch.merchantRaw,
      transactionDate: patch.transactionDate,
      sourceConfidence: link.cardId ? ('high' as const) : item.sourceConfidence,
    };
    const vault = await ingest.mutateAsync({
      userId,
      parsed,
      source: item.source,
      rawText: item.rawText,
      cardId: link.cardId,
      allowDuplicate: Boolean(item.duplicateOf),
      linkStatus: link.linkStatus,
      cardHint: link.cardHint,
    });
    if (vault.status === 'confirmed') return;
    openedPendingIds.current.add(vault.id);
    await confirm.mutateAsync({
      id: vault.id,
      amount: patch.amount,
      merchantRaw: patch.merchantRaw,
      cardId: link.cardId,
      transactionDate: patch.transactionDate,
      linkStatus: link.linkStatus,
      cardHint: link.cardHint,
    });
  };

  const handleDismissItem = async (item: ConfirmFlowItem) => {
    if (item.vaultId) {
      await dismiss.mutateAsync(item.vaultId);
    }
  };

  const milestones = scopedSnapshot?.milestones ?? [];
  const pointsExpiring = scopedSnapshot?.pointsExpiring ?? [];

  return (
    <TrackThemeProvider pair={accentPair}>
      <View style={styles.root}>
        <GlowBackground
          accentColor={accentPair.accent}
          accentDeep={accentPair.accentDeep}
        />
        <ParsingStatusPill state={parsingState} />
        <View style={styles.noticeSlot}>
          <MilestoneResetNoticeBanner />
        </View>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => {
            viewportH.value = e.nativeEvent.layout.height;
          }}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + 110,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ScrollRevealProvider scrollY={scrollY} viewportH={viewportH}>
            <AnimatedEntrance>
              <Eyebrow color={palette.indigo}>Benefits & tracking</Eyebrow>
              <AppText variant="h1" style={styles.screenTitle}>
                Track
              </AppText>
            </AnimatedEntrance>

            <AnimatedEntrance delay={40}>
              <SegmentedControl
                options={SEGMENTS}
                value={segment}
                onChange={setSegment}
              />
            </AnimatedEntrance>

            {attention.length > 0 ? (
              <GlassCard style={styles.hint} padding={spacing.md}>
                <View style={[styles.attentionBadge, { backgroundColor: palette.amber }]}>
                  <AppText variant="caption" color={palette.textOnAccent}>
                    {attention.length}
                  </AppText>
                </View>
                <AppText variant="small" style={styles.hintMessage} numberOfLines={2}>
                  Needs attention · {attention.length} unlinked transaction
                  {attention.length === 1 ? '' : 's'}
                </AppText>
                <Pressable
                  onPress={() => setAttentionOpen(true)}
                  hitSlop={8}
                  style={styles.hintCta}
                >
                  <AppText variant="small" color={accentPair.accent}>
                    Review
                  </AppText>
                </Pressable>
              </GlassCard>
            ) : null}

            {clipboardHint && segment === 'checklist' ? (
              <GlassCard style={styles.hint} padding={spacing.md}>
                <AppText variant="small" style={styles.hintMessage} numberOfLines={3}>
                  {clipboardHint}
                </AppText>
                <Pressable onPress={importClipboard} hitSlop={8} style={styles.hintCta}>
                  <AppText variant="small" color={accentPair.accent}>
                    Review & import
                  </AppText>
                </Pressable>
              </GlassCard>
            ) : null}

            {showOcr && segment === 'checklist' ? (
              <GlassCard style={styles.ocrBox} padding={spacing.lg}>
                <AppText variant="title">Paste alert text</AppText>
                <AppText variant="caption" color={palette.textTertiary}>
                  Paste a bank alert from your clipboard. Real screenshot capture
                  isn’t available yet.
                </AppText>
                <FloatingLabelField
                  label="Alert text"
                  icon="document-text-outline"
                  value={ocrText}
                  onChangeText={setOcrText}
                  multiline
                />
                <PillButton
                  label="Parse & review"
                  onPress={importOcrText}
                  loading={parsingState === 'reading'}
                />
              </GlassCard>
            ) : null}

            {pending.length > 0 && !sheetOpen ? (
              <GlassCard style={styles.hint} padding={spacing.md}>
                <AppText variant="small" style={styles.hintMessage} numberOfLines={2}>
                  {pending.length} pending import{pending.length === 1 ? '' : 's'} to review
                </AppText>
                <Pressable
                  onPress={() => {
                    pending.forEach((p) => openedPendingIds.current.add(p.id));
                    void openConfirmSheet(pending.map(confirmItemFromVaultTxn));
                  }}
                  hitSlop={8}
                  style={styles.hintCta}
                >
                  <AppText variant="small" color={accentPair.accent}>
                    Open review
                  </AppText>
                </Pressable>
              </GlassCard>
            ) : null}

            {isLoading && segment === 'checklist' ? (
              <ActivityIndicator
                color={accentPair.accent}
                style={{ marginTop: spacing.xl }}
              />
            ) : (
              <SegmentBody segment={segment} key={segment}>
                {segment === 'checklist' ? (
                  <TrackChecklistPanel
                    cards={
                      selectedCardId
                        ? cards.filter((c) => c.id === selectedCardId)
                        : cards
                    }
                    preferredStatementCardId={selectedCardId}
                    milestones={milestones}
                    pointsExpiring={pointsExpiring}
                    themeByCardId={themeByCardId}
                    onImportClipboard={importClipboard}
                    onImportScreenshot={() => setShowOcr((v) => !v)}
                    onAddCard={() => {
                      if (!requireAuth({ message: 'Sign in to add a card' })) return;
                      router.push('/card/new' as Href);
                    }}
                    showOcr={showOcr}
                    delayBase={40}
                  />
                ) : null}
                {segment === 'calendar' ? (
                  <TrackCalendarPanel delayBase={40} />
                ) : null}
                {segment === 'protection' ? (
                  <TrackProtectionPanel delayBase={40} />
                ) : null}
              </SegmentBody>
            )}
          </ScrollRevealProvider>
        </Animated.ScrollView>

        <ConfirmTransactionsSheet
          visible={sheetOpen}
          items={confirmItems}
          cards={cards}
          loading={ingest.isPending || confirm.isPending || dismiss.isPending}
          onClose={() => {
            setSheetOpen(false);
            setConfirmItems([]);
          }}
          onBatchStart={async (items) => {
            const raw = clipboardBatchRaw.current ?? items[0]?.rawText;
            if (raw && items.some((i) => i.source === 'clipboard')) {
              await markClipboardProcessed(raw);
            }
          }}
          onConfirm={handleConfirmItem}
          onDismiss={handleDismissItem}
          onComplete={() => {
            setClipboardHint(null);
            refetch();
          }}
        />

        <AttentionTransactionsSheet
          visible={attentionOpen}
          items={attention}
          cards={cards}
          loading={linkTxn.isPending}
          onClose={() => setAttentionOpen(false)}
          onAssign={async (txnId, cardId) => {
            await linkTxn.mutateAsync({
              id: txnId,
              cardId,
              linkStatus: 'linked',
            });
          }}
          onMarkUnmatched={async (txnId) => {
            await linkTxn.mutateAsync({
              id: txnId,
              cardId: null,
              linkStatus: 'unmatched',
            });
          }}
        />
      </View>
    </TrackThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  noticeSlot: { zIndex: 30 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  screenTitle: { marginTop: 2 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  hintMessage: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  hintCta: {
    flexShrink: 0,
  },
  attentionBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrBox: { gap: spacing.md },
});
