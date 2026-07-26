/**
 * Vault tab — adaptive-density card list + empty state.
 * Density tier comes from the total card count (see lib/vaultDensity.ts).
 * Filters live behind a floating button (bottom sheet) so the list keeps the page.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { EmptyVault } from '@/components/vault/EmptyVault';
import { VaultCardList } from '@/components/vault/VaultCardList';
import { VaultFilterFab } from '@/components/vault/VaultFilterFab';
import { VaultAddCardFab } from '@/components/vault/VaultAddCardFab';
import {
  VaultFiltersSheet,
  type FeeFilter,
  type SortKey,
} from '@/components/vault/VaultFiltersSheet';
import {
  NetworkBadge,
  networkAccessibilityLabel,
} from '@/components/vault/NetworkBadge';
import { useAuthStore } from '@/stores/authStore';
import { useCards } from '@/hooks/useCards';
import { useRequireAuth, AUTH_REASONS } from '@/lib/requireAuth';
import { vaultDensityForCount } from '@/lib/vaultDensity';
import { vaultListMode } from '@/lib/vaultListMode';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { CARD_NETWORKS, type CardNetwork, type VaultCard } from '@/types/card';

const NETWORK_CHIPS = [
  { id: 'all', label: 'All', accessibilityLabel: 'All networks' },
  ...CARD_NETWORKS.map((n) => ({
    id: n,
    label: n,
    accessibilityLabel: networkAccessibilityLabel(n),
    leading: () => (
      <NetworkBadge network={n as CardNetwork} size="sm" bare />
    ),
    iconOnly: true,
  })),
];

const FEE_CHIPS = [
  { id: 'all', label: 'All fees' },
  { id: 'due_soon', label: 'Fee due soon' },
  { id: 'no_fee', label: 'No annual fee' },
];

const SORT_CHIPS = [
  { id: 'recent', label: 'Recently added' },
  { id: 'fee_due', label: 'Fee due date' },
  { id: 'bank', label: 'Bank A–Z' },
];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function filterAndSort(
  cards: VaultCard[],
  network: string,
  fee: FeeFilter,
  bank: string,
  sort: SortKey,
): VaultCard[] {
  let list = [...cards];

  if (network !== 'all') {
    list = list.filter((c) => c.network === network);
  }
  if (fee === 'no_fee') {
    list = list.filter((c) => c.annualFee == null || c.annualFee === 0);
  } else if (fee === 'due_soon') {
    list = list.filter((c) => {
      const days = daysUntil(c.feeDueDate);
      return days != null && days >= 0 && days <= 30;
    });
  }
  if (bank !== 'all') {
    list = list.filter((c) => c.bankName === bank);
  }

  list.sort((a, b) => {
    if (sort === 'bank') {
      return a.bankName.localeCompare(b.bankName) || a.nickname.localeCompare(b.nickname);
    }
    if (sort === 'fee_due') {
      const da = daysUntil(a.feeDueDate);
      const db = daysUntil(b.feeDueDate);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return list;
}

export default function VaultScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const requireAuth = useRequireAuth();
  const {
    data: cards,
    isError,
    isSuccess,
    isPending,
    fetchStatus,
    refetch,
  } = useCards(userId);

  const hasCachedCards = (cards?.length ?? 0) > 0;
  const listMode = vaultListMode({
    cardCount: cards?.length ?? 0,
    isPending,
    isError,
    isSuccess,
    fetchStatus,
  });
  const showEmpty = listMode === 'empty';
  const showSpinner = listMode === 'spinner';
  const showError = listMode === 'error';

  const [network, setNetwork] = useState('all');
  const [fee, setFee] = useState<FeeFilter>('all');
  const [bank, setBank] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const bankChips = useMemo(() => {
    const banks = [...new Set((cards ?? []).map((c) => c.bankName).filter(Boolean))].sort();
    return [{ id: 'all', label: 'All banks' }, ...banks.map((b) => ({ id: b, label: b }))];
  }, [cards]);

  const filtered = useMemo(
    () => filterAndSort(cards ?? [], network, fee, bank, sort),
    [cards, network, fee, bank, sort],
  );

  const activeFilterCount =
    (network !== 'all' ? 1 : 0) +
    (fee !== 'all' ? 1 : 0) +
    (bank !== 'all' ? 1 : 0) +
    (sort !== 'recent' ? 1 : 0);

  const clearFilters = () => {
    setNetwork('all');
    setFee('all');
    setBank('all');
    setSort('recent');
  };

  const totalCount = cards?.length ?? 0;
  const density = vaultDensityForCount(totalCount);
  const goAdd = () =>
    requireAuth({
      message: AUTH_REASONS.addCard,
      preferSignUp: true,
      then: () => router.push('/card/new'),
    });
  const goDetail = (id: string) =>
    requireAuth({
      message: AUTH_REASONS.cardDetail,
      then: () => router.push(`/card/${id}` as Href),
    });

  // Sit just above the floating tab bar (~72px bar + safe area gap).
  const fabBottom = insets.bottom + 88;

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl },
        ]}
      >
        <View style={styles.headerText}>
          <Eyebrow color={palette.indigo}>Vault</Eyebrow>
          <AppText variant="h1">Your cards</AppText>
          {activeFilterCount > 0 ? (
            <AppText variant="caption" color={palette.indigo}>
              {filtered.length} of {totalCount} shown
            </AppText>
          ) : totalCount > 0 ? (
            <AppText variant="caption" color={palette.textTertiary}>
              {totalCount} card{totalCount === 1 ? '' : 's'} ·{' '}
              {density === 'spotlight'
                ? 'spotlight view'
                : density === 'compact'
                  ? 'compact view'
                  : 'list view'}
            </AppText>
          ) : null}
        </View>
      </View>

      {showSpinner ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.indigo} />
        </View>
      ) : null}

      {showError ? (
        <View style={styles.center}>
          <AppText variant="small" color={palette.amber}>
            Couldn’t load cards.
          </AppText>
          <Pressable onPress={() => refetch()}>
            <AppText variant="body" color={palette.indigo}>
              Retry
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {showEmpty ? <EmptyVault onAdd={goAdd} /> : null}

      {hasCachedCards ? (
        <>
          <ScrollView
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + 168 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <View style={styles.noMatchWrap}>
                <AppText
                  variant="body"
                  color={palette.textSecondary}
                  style={styles.noMatch}
                >
                  No cards match these filters.
                </AppText>
                <Pressable onPress={clearFilters} hitSlop={8}>
                  <AppText variant="small" color={palette.indigo}>
                    Clear filters
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <VaultCardList
                cards={filtered}
                totalCount={totalCount}
                onSelect={goDetail}
              />
            )}
          </ScrollView>

          <VaultFilterFab
            bottom={fabBottom}
            activeCount={activeFilterCount}
            onPress={() => setFiltersOpen(true)}
          />
          <VaultAddCardFab bottom={fabBottom} onPress={goAdd} />

          <VaultFiltersSheet
            visible={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            network={network}
            fee={fee}
            bank={bank}
            sort={sort}
            onNetworkChange={setNetwork}
            onFeeChange={setFee}
            onBankChange={setBank}
            onSortChange={setSort}
            networkOptions={NETWORK_CHIPS}
            feeOptions={FEE_CHIPS}
            bankOptions={bankChips}
            sortOptions={SORT_CHIPS}
            activeCount={activeFilterCount}
            onClear={clearFilters}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    marginBottom: spacing.md,
  },
  headerText: { gap: 2 },
  list: {
    paddingHorizontal: spacing.xl,
  },
  noMatchWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  noMatch: {
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
