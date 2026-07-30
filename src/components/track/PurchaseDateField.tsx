/**
 * PurchaseDateField — full YYYY-MM-DD via wheel bottom sheet (same pattern as
 * ExpiryMonthYearField).
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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
  };
}

function toIso(y: number, m: number, d: number): string {
  const max = daysInMonth(y, m);
  const day = Math.min(d, max);
  return `${y}-${pad2(m)}-${pad2(day)}`;
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
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        style={{ height: WHEEL_H }}
      >
        {values.map((v) => (
          <Pressable
            key={v}
            onPress={() => {
              onChange(v);
              ref.current?.scrollTo({
                y: values.indexOf(v) * ITEM_H,
                animated: true,
              });
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

export function PurchaseDateField({
  value,
  onChange,
  label = 'Purchase date',
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
}) {
  const palette = usePalette();
  const parsed = parseIso(value);
  const [open, setOpen] = useState(false);
  const [draftY, setDraftY] = useState(parsed.y);
  const [draftM, setDraftM] = useState(parsed.m);
  const [draftD, setDraftD] = useState(parsed.d);
  const currentYear = new Date().getFullYear();

  const years = useMemo(
    () => Array.from({ length: 8 }, (_, i) => currentYear - 5 + i),
    [currentYear],
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth(draftY, draftM) }, (_, i) => i + 1),
    [draftY, draftM],
  );

  const openSheet = () => {
    const p = parseIso(value);
    setDraftY(p.y);
    setDraftM(p.m);
    setDraftD(p.d);
    setOpen(true);
  };

  const confirm = () => {
    onChange(toIso(draftY, draftM, draftD));
    setOpen(false);
  };

  const display = (() => {
    const p = parseIso(value);
    try {
      return new Date(p.y, p.m - 1, p.d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return value;
    }
  })();

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
        accessibilityLabel={`${label} ${display}`}
      >
        <Ionicons name="calendar-outline" size={20} color={palette.textTertiary} />
        <AppText variant="body" style={styles.value}>
          {display}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={palette.textTertiary} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <AppText variant="title">Purchase date</AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            Day / month / year
          </AppText>
          <View style={styles.wheels}>
            <WheelColumn
              values={days}
              selected={Math.min(draftD, days.length)}
              onChange={setDraftD}
              format={pad2}
              palette={palette}
            />
            <WheelColumn
              values={months}
              selected={draftM}
              onChange={(m) => {
                setDraftM(m);
                setDraftD((d) => Math.min(d, daysInMonth(draftY, m)));
              }}
              format={pad2}
              palette={palette}
            />
            <WheelColumn
              values={years}
              selected={draftY}
              onChange={(y) => {
                setDraftY(y);
                setDraftD((d) => Math.min(d, daysInMonth(y, draftM)));
              }}
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
    gap: spacing.md,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  wheelCol: {
    width: 80,
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
