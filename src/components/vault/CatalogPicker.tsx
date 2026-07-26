/**
 * CatalogPicker — typeahead over card_catalog (bank / card name).
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
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { CardCatalogEntry } from '@/types/card';

interface CatalogPickerProps {
  selected: CardCatalogEntry | null;
  onSelect: (entry: CardCatalogEntry) => void;
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
  const { data = [], isLoading, isError } = useCardCatalog();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => filterCatalog(data, query).slice(0, 12), [data, query]);
  const showList = !manualMode && !selected && query.trim().length > 0;

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
                We don’t have this one yet — add details manually.
              </AppText>
              <Pressable onPress={onManual} style={styles.manualBtn}>
                <AppText variant="small" color={palette.indigo}>
                  Enter manually
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

      {!selected && !manualMode ? (
        <Pressable onPress={onManual} style={styles.manualLink}>
          <AppText variant="caption" color={palette.indigo}>
            Can’t find it? Enter details manually
          </AppText>
        </Pressable>
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
  manualBtn: { alignSelf: 'flex-start' },
  manualLink: { paddingVertical: spacing.xs },
});
