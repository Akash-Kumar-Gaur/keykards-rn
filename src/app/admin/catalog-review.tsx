/**
 * Internal catalog scrape review — gated by EXPO_PUBLIC_ADMIN_EMAILS.
 * Tabs: Extractions (low-confidence scrape logs) | Discovery (known_cards queue).
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/authStore';
import { showDialog } from '@/stores/dialogStore';
import { isAdminEmail } from '@/lib/admin';
import {
  proposedToBenefits,
  useApproveScrapeLog,
  useKnownCardsCounts,
  useKnownCardsQueue,
  useRejectScrapeLog,
  useScrapeReviewQueue,
  useSetKnownCardStatus,
  type KnownCardExtractionStatus,
  type KnownCardRow,
  type ScrapeLogRow,
} from '@/hooks/useCatalogReview';
import { DEFAULT_CARD_THEME, suggestThemeForBank } from '@/lib/cardThemes';
import {
  NetworkBadge,
  networkAccessibilityLabel,
} from '@/components/vault/NetworkBadge';
import { palette, radius, spacing } from '@/theme';
import type { CardNetwork } from '@/types/card';
import { CARD_NETWORKS } from '@/types/card';

type Tab = 'extraction' | 'discovery';

function ReviewCard({
  item,
  onDone,
}: {
  item: ScrapeLogRow;
  onDone: () => void;
}) {
  const approve = useApproveScrapeLog();
  const reject = useRejectScrapeLog();
  const proposed = item.proposedJson;
  const hasProposal = proposed != null && typeof proposed === 'object';
  const [bankName, setBankName] = useState(
    item.bankName || String(proposed?.bank_name ?? ''),
  );
  const [cardName, setCardName] = useState(
    item.cardName || String(proposed?.card_name ?? ''),
  );
  const [network, setNetwork] = useState<CardNetwork>(() => {
    const n = String(proposed?.network ?? 'Visa');
    return (CARD_NETWORKS.includes(n as CardNetwork) ? n : 'Visa') as CardNetwork;
  });
  const [annualFee, setAnnualFee] = useState(
    proposed?.annual_fee != null ? String(proposed.annual_fee) : '',
  );
  const [benefitsJson, setBenefitsJson] = useState(() => {
    if (!hasProposal) {
      return '[]';
    }
    return JSON.stringify(proposedToBenefits(proposed), null, 2);
  });

  const onApprove = async (edited: boolean) => {
    let benefits;
    try {
      benefits = JSON.parse(benefitsJson);
      if (!Array.isArray(benefits)) throw new Error('benefits must be an array');
    } catch (e) {
      showDialog({
        title: 'Invalid benefits JSON',
        message: e instanceof Error ? e.message : 'Fix the JSON and try again.',
        icon: 'code-slash-outline',
        tone: 'amber',
      });
      return;
    }
    try {
      await approve.mutateAsync({
        logId: item.id,
        bankName: bankName.trim(),
        cardName: cardName.trim(),
        network,
        annualFee: annualFee.trim() ? Number(annualFee) : null,
        cardColorTheme:
          suggestThemeForBank(bankName.trim()) ?? DEFAULT_CARD_THEME,
        sourceUrl: item.sourceUrl,
        benefits,
        edited,
      });
      onDone();
    } catch (e) {
      showDialog({
        title: 'Approve failed',
        message: e instanceof Error ? e.message : 'Something went wrong.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    }
  };

  const onReject = async () => {
    try {
      await reject.mutateAsync(item.id);
      onDone();
    } catch (e) {
      showDialog({
        title: 'Reject failed',
        message: e instanceof Error ? e.message : 'Something went wrong.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    }
  };

  return (
    <GlassCard style={styles.card}>
      <AppText variant="title">{item.cardName || 'Unknown card'}</AppText>
      <AppText variant="caption" color={palette.textSecondary}>
        {item.bankName} · {item.status}
        {item.confidence ? ` · ${item.confidence}` : ''}
      </AppText>
      {item.sourceUrl ? (
        <AppText variant="caption" color={palette.indigo} numberOfLines={2}>
          {item.sourceUrl}
        </AppText>
      ) : null}
      {item.errorMessage ? (
        <View style={styles.errorBox}>
          <AppText variant="caption" color={palette.amber}>
            Error
          </AppText>
          <AppText variant="small" color={palette.amber}>
            {item.errorMessage}
          </AppText>
        </View>
      ) : null}

      <AppText variant="caption" color={palette.textTertiary} style={styles.label}>
        Raw snippet
      </AppText>
      <ScrollView style={styles.snippet} nestedScrollEnabled>
        <AppText variant="caption" color={palette.textSecondary}>
          {item.rawSnippet?.trim()
            ? item.rawSnippet
            : 'No page text was saved for this failure. Re-scrape after the worker fix to capture the snippet.'}
        </AppText>
      </ScrollView>

      {!hasProposal ? (
        <AppText variant="caption" color={palette.textTertiary} style={styles.label}>
          No LLM proposal was saved — fill fields manually or reject and re-scrape.
        </AppText>
      ) : (
        <AppText variant="caption" color={palette.textTertiary} style={styles.label}>
          Proposed / editable extraction
        </AppText>
      )}
      <TextInput
        style={styles.input}
        value={bankName}
        onChangeText={setBankName}
        placeholder="Bank name"
        placeholderTextColor={palette.textTertiary}
      />
      <TextInput
        style={styles.input}
        value={cardName}
        onChangeText={setCardName}
        placeholder="Card name"
        placeholderTextColor={palette.textTertiary}
      />
      <TextInput
        style={styles.input}
        value={annualFee}
        onChangeText={setAnnualFee}
        placeholder="Annual fee"
        keyboardType="number-pad"
        placeholderTextColor={palette.textTertiary}
      />
      <View style={styles.networks}>
        {CARD_NETWORKS.map((n) => (
          <Pressable
            key={n}
            onPress={() => setNetwork(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: network === n }}
            accessibilityLabel={networkAccessibilityLabel(n)}
            style={styles.netChipTouch}
          >
            <NetworkBadge network={n} size="sm" selected={network === n} />
          </Pressable>
        ))}
      </View>
      <TextInput
        style={[styles.input, styles.benefitsBox]}
        value={benefitsJson}
        onChangeText={setBenefitsJson}
        multiline
        autoCorrect={false}
        autoCapitalize="none"
        placeholderTextColor={palette.textTertiary}
      />

      <View style={styles.actions}>
        <PillButton
          label="Approve"
          size="sm"
          onPress={() => onApprove(false)}
          loading={approve.isPending}
        />
        <PillButton
          label="Edit & approve"
          size="sm"
          variant="ghost"
          onPress={() => onApprove(true)}
          loading={approve.isPending}
        />
        <PillButton
          label="Reject"
          size="sm"
          variant="ghost"
          onPress={onReject}
          loading={reject.isPending}
        />
      </View>
    </GlassCard>
  );
}

function DiscoveryCard({
  item,
  onDone,
}: {
  item: KnownCardRow;
  onDone: () => void;
}) {
  const setStatus = useSetKnownCardStatus();

  const act = async (status: KnownCardExtractionStatus) => {
    try {
      await setStatus.mutateAsync({ id: item.id, status });
      onDone();
    } catch (e) {
      showDialog({
        title: 'Update failed',
        message: e instanceof Error ? e.message : 'Something went wrong.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    }
  };

  return (
    <GlassCard style={styles.card}>
      <AppText variant="title">{item.cardName}</AppText>
      <AppText variant="caption" color={palette.textSecondary}>
        {item.bankName} · {item.cardType} · {item.extractionStatus}
        {item.failureCount > 0 ? ` · fails ${item.failureCount}` : ''}
      </AppText>
      <AppText variant="caption" color={palette.indigo} numberOfLines={2}>
        {item.detailUrl}
      </AppText>
      <AppText variant="caption" color={palette.textTertiary}>
        via {item.discoveredFrom}
      </AppText>
      {item.lastError ? (
        <View style={styles.errorBox}>
          <AppText variant="small" color={palette.amber}>
            {item.lastError}
          </AppText>
        </View>
      ) : null}
      <View style={styles.actions}>
        {item.extractionStatus === 'failed' || item.extractionStatus === 'skipped' ? (
          <PillButton
            label="Retry (pending)"
            size="sm"
            onPress={() => act('pending')}
            loading={setStatus.isPending}
          />
        ) : null}
        {item.extractionStatus !== 'skipped' ? (
          <PillButton
            label="Skip"
            size="sm"
            variant="ghost"
            onPress={() => act('skipped')}
            loading={setStatus.isPending}
          />
        ) : null}
        {item.extractionStatus === 'pending' ? (
          <PillButton
            label="Mark failed"
            size="sm"
            variant="ghost"
            onPress={() => act('failed')}
            loading={setStatus.isPending}
          />
        ) : null}
      </View>
    </GlassCard>
  );
}

export default function CatalogReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const email = useAuthStore((s) => s.user?.email);
  const admin = isAdminEmail(email);
  const [tab, setTab] = useState<Tab>('extraction');
  const [discoveryFilter, setDiscoveryFilter] = useState<
    KnownCardExtractionStatus | 'all'
  >('failed');
  const [tick, setTick] = useState(0);

  const scrapeQ = useScrapeReviewQueue(admin && tab === 'extraction');
  const countsQ = useKnownCardsCounts(admin);
  const knownQ = useKnownCardsQueue(admin && tab === 'discovery', discoveryFilter);

  const items = useMemo(() => scrapeQ.data ?? [], [scrapeQ.data, tick]);
  const knownItems = useMemo(() => knownQ.data ?? [], [knownQ.data, tick]);
  const counts = countsQ.data;

  if (!admin) {
    return (
      <View style={styles.root}>
        <GlowBackground />
        <View style={[styles.denied, { paddingTop: insets.top + spacing.xxl }]}>
          <AppText variant="h2">Restricted</AppText>
          <AppText variant="body" color={palette.textSecondary} style={styles.center}>
            Catalog review is limited to admin accounts.
          </AppText>
          <PillButton label="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const loading =
    (tab === 'extraction' && (scrapeQ.isLoading || scrapeQ.isRefetching)) ||
    (tab === 'discovery' && (knownQ.isLoading || knownQ.isRefetching));

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Eyebrow color={palette.indigo}>Internal</Eyebrow>
          <AppText variant="h2">Catalog review</AppText>
        </View>
        <Pressable
          onPress={() => {
            if (tab === 'extraction') scrapeQ.refetch();
            else {
              knownQ.refetch();
              countsQ.refetch();
            }
          }}
          hitSlop={12}
        >
          <Ionicons name="refresh" size={22} color={palette.indigo} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('extraction')}
          style={[styles.tab, tab === 'extraction' && styles.tabOn]}
        >
          <AppText
            variant="small"
            color={tab === 'extraction' ? palette.textOnAccent : palette.textSecondary}
          >
            Extraction
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setTab('discovery')}
          style={[styles.tab, tab === 'discovery' && styles.tabOn]}
        >
          <AppText
            variant="small"
            color={tab === 'discovery' ? palette.textOnAccent : palette.textSecondary}
          >
            Discovery
          </AppText>
        </Pressable>
      </View>

      {tab === 'discovery' && counts ? (
        <View style={styles.counts}>
          {(
            [
              ['pending', counts.pending],
              ['extracted', counts.extracted],
              ['failed', counts.failed],
              ['skipped', counts.skipped],
            ] as const
          ).map(([key, n]) => (
            <Pressable
              key={key}
              onPress={() => setDiscoveryFilter(key)}
              style={[
                styles.countChip,
                discoveryFilter === key && styles.countChipOn,
              ]}
            >
              <AppText
                variant="caption"
                color={
                  discoveryFilter === key ? palette.textOnAccent : palette.textSecondary
                }
              >
                {n} {key}
              </AppText>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setDiscoveryFilter('all')}
            style={[
              styles.countChip,
              discoveryFilter === 'all' && styles.countChipOn,
            ]}
          >
            <AppText
              variant="caption"
              color={
                discoveryFilter === 'all' ? palette.textOnAccent : palette.textSecondary
              }
            >
              all
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={palette.indigo} style={{ marginTop: spacing.xl }} />
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + spacing.huge },
        ]}
      >
        {tab === 'extraction' ? (
          <>
            {items.length === 0 && !loading ? (
              <AppText variant="body" color={palette.textSecondary} style={styles.center}>
                No extraction entries need review.
              </AppText>
            ) : null}
            {items.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                onDone={() => setTick((t) => t + 1)}
              />
            ))}
          </>
        ) : (
          <>
            {knownItems.length === 0 && !loading ? (
              <AppText variant="body" color={palette.textSecondary} style={styles.center}>
                No discovered cards in this filter.
              </AppText>
            ) : null}
            {knownItems.map((item) => (
              <DiscoveryCard
                key={item.id}
                item={item}
                onDone={() => setTick((t) => t + 1)}
              />
            ))}
          </>
        )}
      </ScrollView>
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
  headerText: { flex: 1, gap: 2 },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.glassFill,
    borderWidth: 1,
    borderColor: palette.glassBorder,
  },
  tabOn: {
    backgroundColor: palette.indigo,
    borderColor: palette.indigo,
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  countChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.navy800,
    borderWidth: 1,
    borderColor: palette.glassBorder,
  },
  countChipOn: {
    backgroundColor: palette.indigo,
    borderColor: palette.indigo,
  },
  list: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  card: { gap: spacing.sm },
  label: { marginTop: spacing.sm },
  errorBox: {
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  snippet: {
    maxHeight: 140,
    backgroundColor: palette.navy900,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.glassBorder,
  },
  input: {
    backgroundColor: palette.navy900,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.textPrimary,
    fontSize: 14,
  },
  benefitsBox: {
    minHeight: 160,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  networks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  netChipTouch: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  denied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  center: { textAlign: 'center' },
});
