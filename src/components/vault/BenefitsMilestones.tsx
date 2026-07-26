/**
 * Benefits + milestones editors — full CRUD entry points on card detail / extras.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Tag } from '@/components/ui/Tag';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  useCreateBenefit,
  useUpdateBenefit,
  useDeleteBenefit,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from '@/hooks/useCards';
import { formatInr } from '@/lib/cardUtils';
import { confirmDialog } from '@/stores/dialogStore';
import { spacing, radius } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import {
  BENEFIT_CATEGORIES,
  type BenefitCategory,
  type BenefitFormInput,
  type CardBenefit,
  type CardMilestone,
  type MilestoneFormInput,
} from '@/types/card';

const BENEFIT_DESC_COLLAPSE_LINES = 3;

function ExpandableText({
  text,
  color,
}: {
  text: string;
  color?: string;
}) {
  const palette = usePalette();
  const resolvedColor = color ?? palette.textSecondary;
  const [expanded, setExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);
  const [measured, setMeasured] = useState(false);

  return (
    <View style={styles.expandBlock}>
      {!measured ? (
        <AppText
          variant="small"
          color={resolvedColor}
          style={styles.measureText}
          onTextLayout={(e) => {
            setCanToggle(e.nativeEvent.lines.length > BENEFIT_DESC_COLLAPSE_LINES);
            setMeasured(true);
          }}
        >
          {text}
        </AppText>
      ) : null}
      <AppText
        variant="small"
        color={resolvedColor}
        numberOfLines={expanded ? undefined : BENEFIT_DESC_COLLAPSE_LINES}
      >
        {text}
      </AppText>
      {canToggle ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={8}
          style={styles.showBtn}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less' : 'Show more'}
        >
          <AppText variant="small" color={palette.indigo}>
            {expanded ? 'Show less' : 'Show more'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function BenefitFormFields({
  value,
  onChange,
}: {
  value: BenefitFormInput;
  onChange: (v: BenefitFormInput) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.formGap}>
      <FloatingLabelField
        label="Title"
        icon="gift-outline"
        value={value.title}
        onChangeText={(title) => onChange({ ...value, title })}
      />
      <AppText variant="caption" color={palette.textTertiary}>
        Category
      </AppText>
      <View style={styles.chips}>
        {BENEFIT_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => onChange({ ...value, category: c })}
            style={[
              styles.chip,
              { backgroundColor: palette.glassFill, borderColor: palette.glassBorder },
              value.category === c && {
                backgroundColor: palette.indigo,
                borderColor: palette.indigo,
              },
            ]}
          >
            <AppText
              variant="caption"
              color={value.category === c ? palette.textOnAccent : palette.textSecondary}
            >
              {c}
            </AppText>
          </Pressable>
        ))}
      </View>
      <FloatingLabelField
        label="Description"
        icon="document-text-outline"
        value={value.description}
        onChangeText={(description) => onChange({ ...value, description })}
        multiline
      />
      <FloatingLabelField
        label="Value estimate (₹)"
        icon="cash-outline"
        value={value.valueEstimate != null ? String(value.valueEstimate) : ''}
        onChangeText={(t) =>
          onChange({
            ...value,
            valueEstimate: t.trim() ? Number(t) : null,
          })
        }
        keyboardType="number-pad"
      />
    </View>
  );
}

export function BenefitsSection({
  cardId,
  benefits,
}: {
  cardId: string;
  benefits: CardBenefit[];
}) {
  const palette = usePalette();
  const create = useCreateBenefit(cardId);
  const update = useUpdateBenefit(cardId);
  const remove = useDeleteBenefit(cardId);
  const [draft, setDraft] = useState<BenefitFormInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyDraft = (): BenefitFormInput => ({
    title: '',
    category: 'other',
    description: '',
    valueEstimate: null,
  });

  const save = async () => {
    if (!draft || !draft.title.trim()) return;
    if (editingId) {
      await update.mutateAsync({ id: editingId, input: draft });
    } else {
      await create.mutateAsync(draft);
    }
    setDraft(null);
    setEditingId(null);
  };

  const confirmDelete = async (b: CardBenefit) => {
    const ok = await confirmDialog({
      title: 'Delete benefit?',
      message: `"${b.title}" will be removed from this card.`,
      icon: 'trash-outline',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) remove.mutate(b.id);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <AppText variant="title">Benefits</AppText>
        <PillButton
          label="Add"
          size="sm"
          icon="add"
          variant="ghost"
          onPress={() => {
            setEditingId(null);
            setDraft(emptyDraft());
          }}
        />
      </View>

      {benefits.length === 0 && !draft ? (
        <AppText variant="small" color={palette.textTertiary}>
          No benefits yet. Add lounge, dining, or other perks for fee-payback tracking.
        </AppText>
      ) : null}

      {benefits.map((b) =>
        editingId === b.id && draft ? (
          <GlassCard key={b.id} style={styles.editor}>
            <BenefitFormFields value={draft} onChange={setDraft} />
            <PillButton label="Save benefit" onPress={save} loading={update.isPending} />
            <PillButton
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setDraft(null);
                setEditingId(null);
              }}
            />
          </GlassCard>
        ) : (
          <GlassCard key={b.id} style={styles.item}>
            <View style={styles.itemHead}>
              <AppText variant="body" style={styles.itemTitle}>
                {b.title}
              </AppText>
              <View style={styles.tagWrap}>
                <Tag label={b.category} />
              </View>
            </View>
            {b.description ? <ExpandableText text={b.description} /> : null}
            {b.valueEstimate != null ? (
              <AppText variant="caption" color={palette.green}>
                ~{formatInr(b.valueEstimate)} / yr
              </AppText>
            ) : null}
            <View style={styles.actions}>
              <PillButton
                label="Edit"
                size="sm"
                variant="ghost"
                onPress={() => {
                  setEditingId(b.id);
                  setDraft({
                    title: b.title,
                    category: b.category as BenefitCategory,
                    description: b.description,
                    valueEstimate: b.valueEstimate,
                  });
                }}
              />
              <PillButton
                label="Delete"
                size="sm"
                variant="ghost"
                onPress={() => confirmDelete(b)}
              />
            </View>
          </GlassCard>
        ),
      )}

      {draft && !editingId ? (
        <GlassCard style={styles.editor}>
          <BenefitFormFields value={draft} onChange={setDraft} />
          <PillButton label="Save benefit" onPress={save} loading={create.isPending} />
          <PillButton label="Cancel" variant="ghost" onPress={() => setDraft(null)} />
        </GlassCard>
      ) : null}
    </View>
  );
}
function MilestoneFormFields({
  value,
  onChange,
}: {
  value: MilestoneFormInput;
  onChange: (v: MilestoneFormInput) => void;
}) {
  return (
    <View style={styles.formGap}>
      <FloatingLabelField
        label="Reward description"
        icon="trophy-outline"
        value={value.rewardDescription}
        onChangeText={(rewardDescription) => onChange({ ...value, rewardDescription })}
        multiline
      />
      <FloatingLabelField
        label="Target spend (₹)"
        icon="flag-outline"
        value={String(value.targetSpend || '')}
        onChangeText={(t) => onChange({ ...value, targetSpend: Number(t) || 0 })}
        keyboardType="number-pad"
      />
      <FloatingLabelField
        label="Current spend (₹)"
        icon="trending-up-outline"
        value={String(value.currentSpend || '')}
        onChangeText={(t) => onChange({ ...value, currentSpend: Number(t) || 0 })}
        keyboardType="number-pad"
      />
      <FloatingLabelField
        label="Period start"
        icon="calendar-outline"
        value={value.periodStart}
        onChangeText={(periodStart) => onChange({ ...value, periodStart })}
        autoCapitalize="none"
      />
      <FloatingLabelField
        label="Period end"
        icon="calendar-outline"
        value={value.periodEnd}
        onChangeText={(periodEnd) => onChange({ ...value, periodEnd })}
        autoCapitalize="none"
      />
    </View>
  );
}

export function MilestonesSection({
  cardId,
  milestones,
}: {
  cardId: string;
  milestones: CardMilestone[];
}) {
  const palette = usePalette();
  const create = useCreateMilestone(cardId);
  const update = useUpdateMilestone(cardId);
  const remove = useDeleteMilestone(cardId);
  const [draft, setDraft] = useState<MilestoneFormInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const emptyDraft = (): MilestoneFormInput => ({
    targetSpend: 0,
    currentSpend: 0,
    rewardDescription: '',
    periodStart: today,
    periodEnd: today,
  });

  const save = async () => {
    if (!draft || !draft.rewardDescription.trim() || draft.targetSpend <= 0) return;
    if (editingId) {
      await update.mutateAsync({ id: editingId, input: draft });
    } else {
      await create.mutateAsync(draft);
    }
    setDraft(null);
    setEditingId(null);
  };

  const confirmDelete = async (m: CardMilestone) => {
    const ok = await confirmDialog({
      title: 'Delete milestone?',
      message: 'This milestone and its recorded progress will be removed.',
      icon: 'trash-outline',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) remove.mutate(m.id);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <AppText variant="title">Milestones</AppText>
        <PillButton
          label="Add"
          size="sm"
          icon="add"
          variant="ghost"
          onPress={() => {
            setEditingId(null);
            setDraft(emptyDraft());
          }}
        />
      </View>

      {milestones.length === 0 && !draft ? (
        <AppText variant="small" color={palette.textTertiary}>
          No milestones yet. Track spend targets for bonus rewards.
        </AppText>
      ) : null}

      {milestones.map((m) => {
        const progress =
          m.targetSpend > 0 ? Math.min(1, m.currentSpend / m.targetSpend) : 0;
        if (editingId === m.id && draft) {
          return (
            <GlassCard key={m.id} style={styles.editor}>
              <MilestoneFormFields value={draft} onChange={setDraft} />
              <PillButton label="Save milestone" onPress={save} loading={update.isPending} />
              <PillButton
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setDraft(null);
                  setEditingId(null);
                }}
              />
            </GlassCard>
          );
        }
        return (
          <GlassCard key={m.id} style={styles.item}>
            <AppText variant="body">{m.rewardDescription}</AppText>
            <AppText variant="caption" color={palette.textSecondary}>
              {formatInr(m.currentSpend)} / {formatInr(m.targetSpend)}
            </AppText>
            <ProgressBar progress={progress} />
            <AppText variant="caption" color={palette.textTertiary}>
              {m.periodStart} → {m.periodEnd}
            </AppText>
            <View style={styles.actions}>
              <PillButton
                label="Edit"
                size="sm"
                variant="ghost"
                onPress={() => {
                  setEditingId(m.id);
                  setDraft({
                    targetSpend: m.targetSpend,
                    currentSpend: m.currentSpend,
                    rewardDescription: m.rewardDescription,
                    periodStart: m.periodStart,
                    periodEnd: m.periodEnd,
                  });
                }}
              />
              <PillButton
                label="Delete"
                size="sm"
                variant="ghost"
                onPress={() => confirmDelete(m)}
              />
            </View>
          </GlassCard>
        );
      })}

      {draft && !editingId ? (
        <GlassCard style={styles.editor}>
          <MilestoneFormFields value={draft} onChange={setDraft} />
          <PillButton label="Save milestone" onPress={save} loading={create.isPending} />
          <PillButton label="Cancel" variant="ghost" onPress={() => setDraft(null)} />
        </GlassCard>
      ) : null}
    </View>
  );
}

export function FeePaybackIndicator({
  annualFee,
  benefits,
}: {
  annualFee: number | null;
  benefits: CardBenefit[];
}) {
  const palette = usePalette();
  if (annualFee == null || annualFee <= 0) return null;
  const valueSum = benefits.reduce((s, b) => s + (b.valueEstimate ?? 0), 0);
  const ratio = valueSum / annualFee;
  const covered = ratio >= 1;

  return (
    <GlassCard style={styles.item}>
      <AppText variant="title">Fee payback</AppText>
      <AppText variant="small" color={palette.textSecondary}>
        Benefit value estimates vs annual fee (simple preview — Track will refine this).
      </AppText>
      <AppText variant="h2" color={covered ? palette.green : palette.amber}>
        {formatInr(valueSum)} / {formatInr(annualFee)}
      </AppText>
      <ProgressBar progress={Math.min(1, ratio)} />
      <AppText variant="caption" color={palette.textTertiary}>
        {covered
          ? 'Estimated benefits cover the annual fee.'
          : `${Math.round(ratio * 100)}% of fee covered by listed benefits.`}
      </AppText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: { gap: spacing.sm },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  tagWrap: {
    flexShrink: 0,
  },
  expandBlock: { gap: spacing.xs, position: 'relative' },
  measureText: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  showBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editor: { gap: spacing.md },
  formGap: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
