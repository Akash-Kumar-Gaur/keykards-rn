/**
 * Share history for one card — active + past shares, copy link, revoke-now.
 * Active rows: swipe left to reveal Revoke (same pattern as Vault delete).
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { PillButton } from '@/components/ui/PillButton';
import { VaultSwipeableRow } from '@/components/vault/VaultSwipeableRow';
import { useCard } from '@/hooks/useCards';
import { useCardShares, useRevokeCardShare } from '@/hooks/useCardShares';
import {
  cardShareStatus,
  shareWebUrl,
  type CardShareRow,
} from '@/lib/cardShare';
import { recallShareLinkKey } from '@/lib/shareLinkKeys';
import { confirmDialog, showDialog } from '@/stores/dialogStore';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StatusLabel({ share }: { share: CardShareRow }) {
  const palette = usePalette();
  const status = cardShareStatus(share);
  const color =
    status === 'active'
      ? palette.green
      : status === 'revoked'
        ? palette.amber
        : palette.textTertiary;
  const label =
    status === 'active'
      ? 'Active'
      : status === 'revoked'
        ? 'Revoked'
        : status === 'exhausted'
          ? 'View limit reached'
          : 'Expired';
  return (
    <AppText variant="caption" color={color}>
      {label}
    </AppText>
  );
}

function scopeLabel(share: CardShareRow): string {
  return share.revealScope === 'last_four_only'
    ? 'Last 4 + expiry'
    : 'Full number + expiry';
}

export default function CardSharesScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: card } = useCard(id);
  const { data: shares = [], isLoading, refetch } = useCardShares(id);
  const revoke = useRevokeCardShare(id!);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const onCopy = async (share: CardShareRow) => {
    const status = cardShareStatus(share);
    if (status !== 'active') {
      showDialog({
        title: 'Link unavailable',
        message: 'Only active share links can be copied.',
        icon: 'link-outline',
        tone: 'amber',
      });
      return;
    }
    let key: string | null = null;
    if (share.revealScope === 'full') {
      key = await recallShareLinkKey(share.id);
      if (!key) {
        showDialog({
          title: 'Full link not on this device',
          message:
            'The full share link is no longer available on this device. Create a new share to copy a complete link.',
          icon: 'key-outline',
          tone: 'amber',
        });
        return;
      }
    }
    const url = shareWebUrl(share.id, undefined, key);
    await Clipboard.setStringAsync(url);
    setCopiedId(share.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setCopiedId((cur) => (cur === share.id ? null : cur));
    }, 2000);
  };

  const onRevoke = async (share: CardShareRow) => {
    setOpenRowId(null);
    const ok = await confirmDialog({
      title: 'Revoke this link?',
      message:
        'Anyone with the link will immediately see “This link is no longer available” on future opens. Revocation can’t undo a link that was already opened and copied. This can’t be undone.',
      icon: 'ban-outline',
      confirmLabel: 'Revoke now',
      destructive: true,
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync(share.id);
      showDialog({
        title: 'Link revoked',
        message: 'The share is no longer accessible.',
        icon: 'checkmark-circle-outline',
        tone: 'green',
      });
    } catch {
      showDialog({
        title: 'Revoke failed',
        message: 'Please try again.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    }
  };

  return (
    <View style={styles.root}>
      <GlowBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
          <AppText variant="small">Back</AppText>
        </Pressable>

        <Eyebrow color={palette.indigo}>Shared cards</Eyebrow>
        <AppText variant="h1">{card?.nickname ?? 'Shares'}</AppText>
        <GlassCard style={styles.upgradeNote} padding={spacing.md}>
          <AppText variant="caption" color={palette.textSecondary}>
            Share links now use end-to-end encryption. Links created before this
            update were revoked and no longer work — create a new link if you
            still need to share.
          </AppText>
        </GlassCard>
        <AppText variant="body" color={palette.textSecondary}>
          Active and past links for this card. Revoked and expired links stay
          here for your records. Swipe an active link left to revoke.
        </AppText>

        <PillButton
          label="New share link"
          icon="add-outline"
          size="md"
          onPress={() => router.push(`/card/${id}/share` as Href)}
        />

        {isLoading ? (
          <ActivityIndicator color={palette.indigo} style={{ marginTop: 24 }} />
        ) : shares.length === 0 ? (
          <AppText
            variant="body"
            color={palette.textTertiary}
            style={{ marginTop: spacing.xl }}
          >
            No shares yet.
          </AppText>
        ) : (
          <View style={styles.list}>
            {shares.map((s) => {
              const status = cardShareStatus(s);
              const inactive = status !== 'active';
              const justCopied = copiedId === s.id;
              const cardBody = (
                <GlassCard
                  padding={spacing.lg}
                  style={[styles.row, inactive && styles.rowInactive]}
                >
                  <View style={styles.rowHead}>
                    <AppText variant="small" numberOfLines={1} style={{ flex: 1 }}>
                      {s.recipientLabel || 'Untitled share'}
                    </AppText>
                    <StatusLabel share={s} />
                  </View>
                  <AppText variant="caption" color={palette.textTertiary}>
                    {scopeLabel(s)} · Created {formatWhen(s.createdAt)}
                  </AppText>
                  <AppText variant="caption" color={palette.textTertiary}>
                    Expires {formatWhen(s.expiresAt)}
                  </AppText>
                  <AppText variant="caption" color={palette.textSecondary}>
                    {s.viewCount}
                    {s.maxViews != null ? ` / ${s.maxViews}` : ''} view
                    {s.viewCount === 1 ? '' : 's'}
                    {s.lastViewedAt
                      ? ` · last ${formatWhen(s.lastViewedAt)}`
                      : ''}
                  </AppText>
                  {status === 'active' ? (
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => onCopy(s)}
                        style={styles.actionBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Copy share link"
                      >
                        <Ionicons
                          name={justCopied ? 'checkmark' : 'copy-outline'}
                          size={16}
                          color={justCopied ? palette.green : palette.indigo}
                        />
                        <AppText
                          variant="small"
                          color={justCopied ? palette.green : palette.indigo}
                        >
                          {justCopied ? 'Copied' : 'Copy link'}
                        </AppText>
                      </Pressable>
                    </View>
                  ) : null}
                </GlassCard>
              );

              if (inactive) {
                return <View key={s.id}>{cardBody}</View>;
              }

              return (
                <VaultSwipeableRow
                  key={s.id}
                  rowId={s.id}
                  openRowId={openRowId}
                  onOpenChange={setOpenRowId}
                  onActionPress={() => {
                    void onRevoke(s);
                  }}
                  actionLabel="Revoke"
                  actionIcon="ban-outline"
                  actionAccessibilityLabel="Revoke share link"
                  disabled={revoke.isPending}
                >
                  {cardBody}
                </VaultSwipeableRow>
              );
            })}
          </View>
        )}

        <Pressable onPress={() => refetch()} style={styles.refresh}>
          <AppText variant="caption" color={palette.indigo}>
            Refresh
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  list: { gap: spacing.md, marginTop: spacing.sm },
  upgradeNote: { marginTop: spacing.xs },
  row: { gap: 4 },
  rowInactive: { opacity: 0.55 },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refresh: { alignSelf: 'center', padding: spacing.md },
});
