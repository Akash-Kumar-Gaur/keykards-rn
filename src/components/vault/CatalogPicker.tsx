/**
 * CatalogPicker — typeahead over card_catalog (bank / card name).
 * When no match: offer live web search before full manual entry.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { AppText } from '@/components/ui/AppText';
import { NetworkBadge } from '@/components/vault/NetworkBadge';
import { filterCatalog, useCardCatalog } from '@/hooks/useCardCatalog';
import {
  searchCardLive,
  splitBankCardQuery,
} from '@/lib/searchCardLive';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { CardCatalogEntry } from '@/types/card';

interface CatalogPickerProps {
  selected: CardCatalogEntry | null;
  onSelect: (entry: CardCatalogEntry, meta?: { fromLiveSearch?: boolean; message?: string }) => void;
  onClear: () => void;
  onManual: () => void;
  manualMode: boolean;
}

export function CatalogPicker({
  selected,
  onSelect,
  onClear,
  onManual,
  manualMode,
}: CatalogPickerProps) {
  const palette = usePalette();
  const { data = [], isLoading, isError, refetch } = useCardCatalog();
  const [query, setQuery] = useState('');
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveBank, setLiveBank] = useState('');
  const [liveCard, setLiveCard] = useState('');
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const matches = useMemo(() => filterCatalog(data, query).slice(0, 12), [data, query]);
  const showList = !manualMode && !selected && query.trim().length > 0;

  const openLiveSearch = () => {
    const split = splitBankCardQuery(query);
    setLiveBank(split.bankName);
    setLiveCard(split.cardName);
    setLiveError(null);
    setLiveOpen(true);
  };

  const runLiveSearch = async () => {
    if (!liveBank.trim() || !liveCard.trim()) {
      setLiveError('Enter both bank name and card name.');
      return;
    }
    setLiveBusy(true);
    setLiveError(null);
    try {
      const result = await searchCardLive(liveBank, liveCard);
      if (!result.ok) {
        setLiveError(result.error);
        return;
      }
      setLiveOpen(false);
      setQuery('');
      void refetch();
      onSelect(result.entry, {
        fromLiveSearch: true,
        message: result.message,
      });
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Live search failed');
    } finally {
      setLiveBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color={palette.textTertiary}>
        Find your card
      </AppText>

      {selected ? (
        <View
          style={[
            styles.selected,
            {
              backgroundColor: palette.indigoSoft,
              borderColor: palette.glassBorder,
            },
          ]}
        >
          <View style={styles.selectedText}>
            <AppText variant="body">{selected.cardName}</AppText>
            <View style={styles.metaRow}>
              <AppText variant="caption" color={palette.textSecondary}>
                {selected.bankName}
              </AppText>
              <NetworkBadge network={selected.network} size="sm" />
              {selected.defaultAnnualFee != null ? (
                <AppText variant="caption" color={palette.textSecondary}>
                  fee ₹{selected.defaultAnnualFee}
                </AppText>
              ) : null}
            </View>
          </View>
          <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear selection">
            <Ionicons name="close-circle" size={22} color={palette.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <FloatingLabelField
          label="Search bank or card name"
          icon="search-outline"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      )}

      {isLoading ? <ActivityIndicator color={palette.indigo} /> : null}
      {isError ? (
        <AppText variant="small" color={palette.amber}>
          Catalog unavailable — enter details manually.
        </AppText>
      ) : null}

      {showList ? (
        <ScrollView
          style={[
            styles.list,
            {
              borderColor: palette.glassBorder,
              backgroundColor: palette.navy900,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {matches.length === 0 ? (
            <View style={styles.emptyMatch}>
              <AppText variant="small" color={palette.textSecondary}>
                No catalog match yet.
              </AppText>
              <Pressable
                onPress={openLiveSearch}
                style={styles.primaryAction}
                accessibilityRole="button"
              >
                <Ionicons name="globe-outline" size={16} color={palette.indigo} />
                <AppText variant="small" color={palette.indigo}>
                  Can’t find your card? Search for it
                </AppText>
              </Pressable>
              <Pressable onPress={onManual} style={styles.manualBtn}>
                <AppText variant="caption" color={palette.textTertiary}>
                  Or enter manually (no benefits)
                </AppText>
              </Pressable>
            </View>
          ) : (
            matches.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  onSelect(m);
                  setQuery('');
                }}
                style={[styles.row, { borderBottomColor: palette.glassBorder }]}
              >
                <View style={styles.rowText}>
                  <AppText variant="body" numberOfLines={1}>
                    {m.cardName}
                  </AppText>
                  <View style={styles.metaRow}>
                    <AppText variant="caption" color={palette.textSecondary}>
                      {m.bankName}
                    </AppText>
                    <NetworkBadge network={m.network} size="sm" />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : null}

      {liveOpen && !selected ? (
        <View
          style={[
            styles.livePanel,
            {
              borderColor: palette.glassBorder,
              backgroundColor: palette.navy900,
            },
          ]}
        >
          <AppText variant="small" style={{ color: palette.textPrimary }}>
            Search the web for your card
          </AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            We’ll look up benefits and let you review them before saving.
          </AppText>
          <FloatingLabelField
            label="Bank name"
            icon="business-outline"
            value={liveBank}
            onChangeText={setLiveBank}
            autoCapitalize="words"
          />
          <FloatingLabelField
            label="Card name"
            icon="card-outline"
            value={liveCard}
            onChangeText={setLiveCard}
            autoCapitalize="words"
          />
          {liveError ? (
            <AppText variant="small" color={palette.amber}>
              {liveError}
            </AppText>
          ) : null}
          <View style={styles.liveActions}>
            <Pressable
              onPress={() => {
                setLiveOpen(false);
                setLiveError(null);
              }}
              disabled={liveBusy}
              style={styles.manualBtn}
            >
              <AppText variant="caption" color={palette.textTertiary}>
                Cancel
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => void runLiveSearch()}
              disabled={liveBusy}
              style={[
                styles.searchBtn,
                { backgroundColor: palette.indigo },
                liveBusy ? { opacity: 0.7 } : null,
              ]}
            >
              {liveBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <AppText variant="small" style={{ color: '#fff' }}>
                  Search
                </AppText>
              )}
            </Pressable>
          </View>
          {liveError ? (
            <Pressable
              onPress={() => {
                setLiveOpen(false);
                onManual();
              }}
              style={styles.manualBtn}
            >
              <AppText variant="caption" color={palette.indigo}>
                Enter details manually instead
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!selected && !manualMode && !liveOpen ? (
        <View style={styles.footerLinks}>
          <Pressable onPress={openLiveSearch} style={styles.manualLink}>
            <AppText variant="caption" color={palette.indigo}>
              Can’t find your card? Search for it
            </AppText>
          </Pressable>
          <Pressable onPress={onManual} style={styles.manualLink}>
            <AppText variant="caption" color={palette.textTertiary}>
              Enter details manually
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {manualMode && !selected ? (
        <AppText variant="caption" color={palette.textTertiary}>
          Manual entry — benefits won’t auto-fill.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  selectedText: { flex: 1, gap: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  list: {
    maxHeight: 220,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
  emptyMatch: { padding: spacing.lg, gap: spacing.sm },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  manualBtn: { alignSelf: 'flex-start' },
  manualLink: { paddingVertical: spacing.xs },
  footerLinks: { gap: 2 },
  livePanel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  liveActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  searchBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 88,
    alignItems: 'center',
  },
});
