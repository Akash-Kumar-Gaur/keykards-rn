/**
 * Vault tab — swipe-to-delete + long-press multi-select on the compact list.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { EmptyVault } from '@/components/vault/EmptyVault';
import { VaultCardList } from '@/components/vault/VaultCardList';
import { VaultAddCardFab } from '@/components/vault/VaultAddCardFab';
import { VaultSelectionBar } from '@/components/vault/VaultSelectionBar';
import { useAuthStore } from '@/stores/authStore';
import { useCards, useDeleteCards } from '@/hooks/useCards';
import { useRequireAuth, AUTH_REASONS } from '@/lib/requireAuth';
import { vaultListMode } from '@/lib/vaultListMode';
import { confirmDialog, showDialog } from '@/stores/dialogStore';
import { logger } from '@/lib/logger';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import type { VaultCard } from '@/types/card';

function sortRecent(cards: VaultCard[]): VaultCard[] {
  return [...cards].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export default function VaultScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const requireAuth = useRequireAuth();
  const deleteCards = useDeleteCards(userId);
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

  const list = useMemo(() => sortRecent(cards ?? []), [cards]);
  const totalCount = cards?.length ?? 0;

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setOpenRowId(null);
  }, []);

  const enterSelection = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpenRowId(null);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    void Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const confirmDeleteIds = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const names = ids
        .map((id) => list.find((c) => c.id === id)?.nickname)
        .filter(Boolean);
      const title =
        ids.length === 1
          ? 'Delete this card?'
          : `Delete ${ids.length} cards?`;
      const message =
        ids.length === 1
          ? `"${names[0] ?? 'This card'}" and all its benefits, milestones, and shares will be permanently removed. This can’t be undone.`
          : `These ${ids.length} cards and all associated benefits, milestones, and shares will be permanently removed. This can’t be undone.`;
      const ok = await confirmDialog({
        title,
        message,
        icon: 'trash-outline',
        confirmLabel: ids.length === 1 ? 'Delete' : 'Delete all',
        destructive: true,
      });
      if (!ok) return;
      try {
        await deleteCards.mutateAsync(ids);
        exitSelection();
        setOpenRowId(null);
      } catch (err) {
        logger.warn('Vault delete failed', err);
        showDialog({
          title: 'Delete failed',
          message: 'Those cards could not be removed. Please try again.',
          icon: 'alert-circle-outline',
          tone: 'amber',
        });
      }
    },
    [deleteCards, exitSelection, list],
  );

  const fabBottom = insets.bottom + 88;
  const selectionBarBottom = insets.bottom + 88;

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl },
        ]}
      >
        <AppText variant="h1">Vault</AppText>
        {selectionMode ? (
          <Pressable onPress={exitSelection} hitSlop={8}>
            <AppText variant="body" color={palette.indigo}>
              Cancel
            </AppText>
          </Pressable>
        ) : totalCount > 0 ? (
          <Eyebrow color={palette.textTertiary} style={styles.count}>
            {`${totalCount} active`}
          </Eyebrow>
        ) : null}
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
              {
                paddingBottom:
                  insets.bottom + (selectionMode ? 200 : 168),
              },
            ]}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => {
              if (openRowId) setOpenRowId(null);
            }}
            keyboardShouldPersistTaps="handled"
          >
            <VaultCardList
              cards={list}
              onSelect={goDetail}
              onLongPressSelect={enterSelection}
              onRequestDelete={(id) => void confirmDeleteIds([id])}
              openRowId={openRowId}
              onOpenRowChange={setOpenRowId}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          </ScrollView>
          {selectionMode ? (
            <VaultSelectionBar
              count={selectedIds.size}
              bottom={selectionBarBottom}
              deleting={deleteCards.isPending}
              onCancel={exitSelection}
              onDelete={() => void confirmDeleteIds([...selectedIds])}
            />
          ) : (
            <VaultAddCardFab bottom={fabBottom} onPress={goAdd} />
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  count: { flexShrink: 0 },
  list: {
    paddingHorizontal: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
