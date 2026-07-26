/**
 * Track tab — scalable dashboard: overview hero + horizontal category carousels.
 * Clipboard / OCR / pending Gmail confirm via shared parsing pill + bottom sheet.
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
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { GlassCard } from '@/components/ui/GlassCard';
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
import { TrackDashboard } from '@/components/track/TrackDashboard';
import { TrackThemeProvider } from '@/components/track/TrackTheme';
import { TrackCardScopeFab } from '@/components/track/TrackCardScopeFab';
import { TrackCardScopeSheet } from '@/components/track/TrackCardScopeSheet';
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
import { useRequireAuth, AUTH_REASONS } from '@/lib/requireAuth';
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
import { spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useClipboardProcessedStore } from '@/stores/clipboardProcessedStore';
import type { CardColorTheme } from '@/types/card';
import * as Clipboard from 'expo-clipboard';

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

  const [clipboardHint, setClipboardHint] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [showOcr, setShowOcr] = useState(false);
  const [parsingState, setParsingState] = useState<ParsingPillState>(null);
  const [confirmItems, setConfirmItems] = useState<ConfirmFlowItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const openedPendingIds = useRef<Set<string>>(new Set());
  const clipboardBatchRaw = useRef<string | null>(null);

  // Drop stale selection if the card was deleted.
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

  const scopeLabel = selectedCard?.nickname ?? 'All cards';
  const scopeSwatch = selectedCard
    ? accentPairFromThemeId(selectedCard.cardColorTheme).accent
    : null;
  const singleCard = Boolean(selectedCardId);

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

  /**
   * Attach "possible duplicate" refs and out-of-sync flags before showing the
   * sheet so the user sees both before confirming.
   */
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
          // A pending row IS this draft — don't flag it against itself.
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

  /** Open shared confirm sheet for persisted pending rows (e.g. Gmail). */
  useEffect(() => {
    // Never interrupt an active clipboard/OCR confirm session.
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
    if (
      !requireAuth({
        message: 'Sign in to import transactions',
      })
    ) {
      return;
    }
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
      /* continue to full read */
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
    if (
      !requireAuth({
        message: 'Sign in to import transactions',
      })
    ) {
      return;
    }
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
    // Dedupe may return an already-confirmed row — skip re-confirm.
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
            paddingBottom: insets.bottom + 130,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScrollRevealProvider scrollY={scrollY} viewportH={viewportH}>
          <AnimatedEntrance>
            <Eyebrow color={accentPair.accent}>Track</Eyebrow>
            <AppText variant="h1">Spend & rewards</AppText>
            <AppText variant="small" color={palette.textSecondary}>
              {singleCard
                ? `Scoped to ${scopeLabel} — full-width cards for this wallet.`
                : 'Overview across all cards — swipe within each category.'}
            </AppText>
          </AnimatedEntrance>

          <AnimatedEntrance delay={motion.staggerStep}>
            <View style={styles.ingestRow}>
              <PillButton
                label="Import clipboard"
                size="sm"
                icon="clipboard-outline"
                variant="ghost"
                onPress={importClipboard}
                loading={ingest.isPending && parsingState === 'reading'}
              />
              <PillButton
                label="From screenshot"
                size="sm"
                icon="image-outline"
                variant="ghost"
                onPress={() => setShowOcr((v) => !v)}
              />
              <PillButton
                label="Gmail"
                size="sm"
                icon="mail-outline"
                variant="ghost"
                onPress={() =>
                  requireAuth({
                    message: AUTH_REASONS.trackGmail,
                    then: () => router.push('/track/gmail' as Href),
                  })
                }
              />
            </View>
          </AnimatedEntrance>

          {attention.length > 0 ? (
            <AnimatedEntrance delay={motion.staggerStep}>
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
            </AnimatedEntrance>
          ) : null}

          {clipboardHint ? (
            <AnimatedEntrance delay={motion.staggerStep}>
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
            </AnimatedEntrance>
          ) : null}

          {showOcr ? (
            <AnimatedEntrance>
              <GlassCard style={styles.ocrBox} padding={spacing.lg}>
                <AppText variant="title">Screenshot text</AppText>
                <AppText variant="caption" color={palette.textTertiary}>
                  Paste the alert text from your screenshot. We’ll review it the same
                  way as clipboard and Gmail imports.
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
            </AnimatedEntrance>
          ) : null}

          {pending.length > 0 && !sheetOpen ? (
            <AnimatedEntrance delay={motion.staggerStep * 2}>
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
            </AnimatedEntrance>
          ) : null}

          {isLoading ? (
            <ActivityIndicator
              color={accentPair.accent}
              style={{ marginTop: spacing.xl }}
            />
          ) : (
            <TrackDashboard
              snapshot={scopedSnapshot}
              hasCards={cards.length > 0}
              singleCard={singleCard}
              selectedCardId={selectedCardId}
              accent={accentPair}
              themeByCardId={themeByCardId}
            />
          )}

          {!snapshot?.gmailConnected && cards.length > 0 ? (
            <AnimatedEntrance delay={motion.staggerStep * 3}>
              <Pressable
                style={styles.gmailCta}
                onPress={() =>
                  requireAuth({
                    message: AUTH_REASONS.trackGmail,
                    then: () => router.push('/track/gmail' as Href),
                  })
                }
              >
                <Ionicons name="mail-outline" size={20} color={accentPair.accent} />
                <AppText variant="small" color={accentPair.accent}>
                  Optional: connect Gmail (read-only) for bank alerts
                </AppText>
              </Pressable>
            </AnimatedEntrance>
          ) : null}
        </ScrollRevealProvider>
      </Animated.ScrollView>

      {cards.length > 0 ? (
        <TrackCardScopeFab
          bottom={insets.bottom + 88}
          label={scopeLabel}
          swatchColor={scopeSwatch}
          onPress={() => setScopeSheetOpen(true)}
        />
      ) : null}

      <TrackCardScopeSheet
        visible={scopeSheetOpen}
        onClose={() => setScopeSheetOpen(false)}
        cards={cards}
        selectedCardId={selectedCardId}
        onSelect={setSelectedCardId}
      />

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
  ingestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
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
  gmailCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    flexWrap: 'wrap',
  },
});
