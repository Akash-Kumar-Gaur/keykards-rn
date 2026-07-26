/**
 * ExpiryMonthYearField — compact MM/YY field + minimal dual-wheel bottom sheet.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

const ITEM_H = 40;
const VISIBLE = 3;
const WHEEL_H = ITEM_H * VISIBLE;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function WheelColumn({
  values,
  selected,
  onChange,
  format = String,
  palette,
}: {
  values: number[];
  selected: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  palette: ReturnType<typeof usePalette>;
}) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, values.indexOf(selected));

  const onMomentum = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(values.length - 1, i));
    onChange(values[clamped]!);
  };

  return (
    <View
      style={[
        styles.wheelCol,
        {
          backgroundColor: palette.navy900,
          borderColor: palette.glassBorder,
        },
      ]}
    >
      <View
        style={[styles.wheelHighlight, { backgroundColor: palette.indigoSoft }]}
        pointerEvents="none"
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentum}
        onScrollEndDrag={onMomentum}
        contentOffset={{ x: 0, y: index * ITEM_H }}
        contentContainerStyle={{
          paddingVertical: ITEM_H,
        }}
        style={{ height: WHEEL_H }}
      >
        {values.map((v) => (
          <Pressable
            key={v}
            onPress={() => {
              onChange(v);
              ref.current?.scrollTo({ y: values.indexOf(v) * ITEM_H, animated: true });
            }}
            style={styles.wheelItem}
          >
            <AppText
              variant="body"
              color={v === selected ? palette.textPrimary : palette.textTertiary}
            >
              {format(v)}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function ExpiryMonthYearField({
  month,
  year,
  onChange,
  yearSpan = 10,
  label = 'Expiry',
}: {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
  /** Years from current year inclusive (default current → +10). */
  yearSpan?: number;
  label?: string;
}) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const [draftM, setDraftM] = useState(month);
  const [draftY, setDraftY] = useState(year);
  const currentYear = new Date().getFullYear();

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const years = useMemo(
    () => Array.from({ length: yearSpan + 1 }, (_, i) => currentYear + i),
    [currentYear, yearSpan],
  );

  const openSheet = () => {
    setDraftM(month);
    setDraftY(year);
    setOpen(true);
  };

  const confirm = () => {
    onChange(draftM, draftY);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color={palette.textTertiary}>
        {label}
      </AppText>
      <Pressable
        onPress={openSheet}
        style={[
          styles.field,
          {
            borderColor: palette.glassBorder,
            backgroundColor: palette.glassFill,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${pad2(month)}/${String(year).slice(-2)}`}
      >
        <Ionicons name="calendar-outline" size={20} color={palette.textTertiary} />
        <AppText variant="body" style={styles.value}>
          {pad2(month)}/{String(year).slice(-2)}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={palette.textTertiary} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <AppText variant="title">Expiry</AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            Month / year
          </AppText>
          <View style={styles.wheels}>
            <WheelColumn
              values={months}
              selected={draftM}
              onChange={setDraftM}
              format={pad2}
              palette={palette}
            />
            <WheelColumn
              values={years}
              selected={draftY}
              onChange={setDraftY}
              palette={palette}
            />
          </View>
          <PillButton label="Done" onPress={confirm} fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  value: { flex: 1 },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  wheels: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  wheelCol: {
    width: 96,
    height: WHEEL_H,
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H,
    height: ITEM_H,
    zIndex: 1,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
