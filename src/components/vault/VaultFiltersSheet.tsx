/**
 * VaultFiltersSheet — network / fee / bank / sort filters, opened from a FAB
 * so they no longer eat half the Vault screen. Same AnimatedFilterChips pattern
 * as before; Clear filters resets everything to defaults.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  AnimatedFilterChips,
  type FilterChipOption,
} from '@/components/vault/AnimatedFilterChips';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export type FeeFilter = 'all' | 'due_soon' | 'no_fee';
export type SortKey = 'recent' | 'fee_due' | 'bank';

interface VaultFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  network: string;
  fee: FeeFilter;
  bank: string;
  sort: SortKey;
  onNetworkChange: (id: string) => void;
  onFeeChange: (id: FeeFilter) => void;
  onBankChange: (id: string) => void;
  onSortChange: (id: SortKey) => void;
  networkOptions: FilterChipOption[];
  feeOptions: FilterChipOption[];
  bankOptions: FilterChipOption[];
  sortOptions: FilterChipOption[];
  activeCount: number;
  onClear: () => void;
}

export function VaultFiltersSheet({
  visible,
  onClose,
  network,
  fee,
  bank,
  sort,
  onNetworkChange,
  onFeeChange,
  onBankChange,
  onSortChange,
  networkOptions,
  feeOptions,
  bankOptions,
  sortOptions,
  activeCount,
  onClear,
}: VaultFiltersSheetProps) {
  const palette = usePalette();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <View>
          <Eyebrow color={palette.indigo}>Vault</Eyebrow>
          <AppText variant="h2">Filter & sort</AppText>
        </View>
        {activeCount > 0 ? (
          <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
            <AppText variant="small" color={palette.indigo}>
              Clear all
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <FilterGroup label="Network">
        <AnimatedFilterChips
          options={networkOptions}
          value={network}
          onChange={onNetworkChange}
        />
      </FilterGroup>

      <FilterGroup label="Annual fee">
        <AnimatedFilterChips
          options={feeOptions}
          value={fee}
          onChange={(id) => onFeeChange(id as FeeFilter)}
        />
      </FilterGroup>

      {bankOptions.length > 2 ? (
        <FilterGroup label="Bank">
          <AnimatedFilterChips
            options={bankOptions}
            value={bank}
            onChange={onBankChange}
          />
        </FilterGroup>
      ) : null}

      <FilterGroup label="Sort by">
        <AnimatedFilterChips
          options={sortOptions}
          value={sort}
          onChange={(id) => onSortChange(id as SortKey)}
        />
      </FilterGroup>

      <Pressable
        style={[styles.done, { backgroundColor: palette.indigo }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <AppText variant="body" color={palette.textOnAccent}>
          Done
        </AppText>
      </Pressable>
    </BottomSheet>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={styles.group}>
      <AppText variant="caption" color={palette.textTertiary} style={styles.groupLabel}>
        {label}
      </AppText>
      <View style={styles.chipsBleed}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  group: { gap: spacing.xs },
  groupLabel: { paddingLeft: spacing.xs },
  // AnimatedFilterChips already pads horizontally — pull flush with the sheet.
  chipsBleed: { marginHorizontal: -spacing.xl },
  done: {
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
});
