/**
 * CatalogBenefitsSummary — collapsed by default; expands only on explicit tap.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { BenefitFormInput } from '@/types/card';

export function CatalogBenefitsSummary({
  benefits,
  bankLabel,
  onChange,
  onRemove,
}: {
  benefits: BenefitFormInput[];
  bankLabel: string | null;
  onChange: (index: number, patch: Partial<BenefitFormInput>) => void;
  onRemove: (index: number) => void;
}) {
  const palette = usePalette();
  const [expanded, setExpanded] = useState(false);
  const open = useSharedValue(0);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    open.value = withTiming(next ? 1 : 0, { duration: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${open.value * 180}deg` }],
  }));

  if (benefits.length === 0) return null;

  const from = bankLabel?.trim() ? bankLabel.trim() : 'catalog';

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        style={[
          styles.summary,
          {
            borderColor: palette.glassBorder,
            backgroundColor: palette.indigoSoft,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${benefits.length} benefits from ${from}. ${expanded ? 'Collapse' : 'Expand to review'}`}
      >
        <Ionicons name="gift-outline" size={18} color={palette.indigo} />
        <AppText variant="small" style={[styles.summaryText, { color: palette.textPrimary }]} numberOfLines={2}>
          {benefits.length} benefit{benefits.length === 1 ? '' : 's'} added from {from}{' '}
          catalog
        </AppText>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={palette.textTertiary} />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <View style={styles.list}>
          <AppText variant="caption" color={palette.textTertiary}>
            Optional — edit or remove before saving. You can also manage benefits later
            from the card.
          </AppText>
          {benefits.map((b, i) => (
            <GlassCard key={`${b.title}-${i}`} padding={spacing.md} style={styles.card}>
              <View style={styles.head}>
                <AppText variant="small" color={palette.indigo}>
                  {b.category}
                </AppText>
                <Pressable onPress={() => onRemove(i)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={palette.amber} />
                </Pressable>
              </View>
              <FloatingLabelField
                label="Title"
                icon="gift-outline"
                value={b.title}
                onChangeText={(title) => onChange(i, { title })}
              />
              <FloatingLabelField
                label="Description"
                icon="document-text-outline"
                value={b.description}
                onChangeText={(description) => onChange(i, { description })}
                multiline
              />
              <FloatingLabelField
                label="Value estimate (₹)"
                icon="cash-outline"
                value={b.valueEstimate != null ? String(b.valueEstimate) : ''}
                onChangeText={(t) =>
                  onChange(i, {
                    valueEstimate: t.trim() ? Number(t) : null,
                  })
                }
                keyboardType="number-pad"
              />
            </GlassCard>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  summaryText: { flex: 1 },
  list: { gap: spacing.sm },
  card: { gap: spacing.sm },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
