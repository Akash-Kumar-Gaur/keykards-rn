/**
 * Create-share screen — expiry presets, optional label / max-views, security copy,
 * then native share sheet + copy link.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useCard } from '@/hooks/useCards';
import { useCreateCardShare, type CreatedShare } from '@/hooks/useCardShares';
import {
  DEFAULT_REVEAL_SCOPE,
  DEFAULT_SHARE_TTL_ID,
  SHARE_REVEAL_OPTIONS,
  SHARE_TTL_PRESETS,
  type ShareRevealScope,
  type ShareTtlId,
} from '@/lib/cardShare';
import {
  BiometricRequiredError,
  isUnrecoverableCardError,
} from '@/lib/crypto';
import { showDialog } from '@/stores/dialogStore';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function CreateShareScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: card, isLoading } = useCard(id);
  const createShare = useCreateCardShare();

  const [ttlId, setTtlId] = useState<ShareTtlId>(DEFAULT_SHARE_TTL_ID);
  const [revealScope, setRevealScope] =
    useState<ShareRevealScope>(DEFAULT_REVEAL_SCOPE);
  const [label, setLabel] = useState('');
  const [limitViews, setLimitViews] = useState(false);
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [copied, setCopied] = useState(false);

  const onCreate = async () => {
    if (!card) return;
    try {
      const share = await createShare.mutateAsync({
        card,
        ttlId,
        recipientLabel: label,
        maxViews: limitViews ? 1 : null,
        revealScope,
      });
      setCreated(share);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (err instanceof BiometricRequiredError) return;
      if (isUnrecoverableCardError(err)) {
        showDialog({
          title: 'Re-enter card to share',
          message:
            'Re-enter this card’s number in Edit card before sharing — the saved encryption key can’t unlock it on this device.',
          icon: 'key-outline',
          tone: 'amber',
          actions: [
            { label: 'Not now', variant: 'ghost' },
            {
              label: 'Edit card',
              variant: 'primary',
              onPress: () => router.push(`/card/${id}/edit` as Href),
            },
          ],
        });
        return;
      }
      showDialog({
        title: 'Couldn’t create share',
        message:
          err instanceof Error ? err.message : 'Please try again in a moment.',
        icon: 'alert-circle-outline',
        tone: 'amber',
      });
    }
  };

  const onNativeShare = async () => {
    if (!created) return;
    try {
      await Share.share({
        message: `I’m sharing a card with you via InWallet (view-only, no CVV):\n${created.url}`,
        url: created.url,
        title: 'Share card link',
      });
    } catch {
      // User cancelled — ignore.
    }
  };

  const onCopy = async () => {
    if (!created) return;
    await Clipboard.setStringAsync(created.url);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !card) {
    return (
      <View style={styles.root}>
        <GlowBackground />
        <View style={styles.center}>
          <ActivityIndicator color={palette.indigo} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <GlowBackground />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
          <AppText variant="small">Back</AppText>
        </Pressable>

        <Eyebrow color={palette.indigo}>Share</Eyebrow>
        <AppText variant="h1">{card.nickname}</AppText>
        <AppText variant="body" color={palette.textSecondary}>
          {card.bankName} · ···· {card.lastFour}
        </AppText>

        {!created ? (
          <>
            <GlassCard style={styles.warn} padding={spacing.lg}>
              <View style={styles.warnRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={palette.amber}
                />
                <AppText variant="small" color={palette.textSecondary} style={{ flex: 1 }}>
                  Anyone with this exact link can view what you choose below —
                  treat it like a password. The card number is encrypted on your
                  device; the unlock secret is only in the link itself and is
                  never stored on our servers. Revoking stops future opens, but can’t
                  undo a link that was already opened. CVV is never shared.
                </AppText>
              </View>
            </GlassCard>

            <AppText variant="caption" color={palette.textTertiary}>
              What can they see?
            </AppText>
            <View style={styles.scopeList}>
              {SHARE_REVEAL_OPTIONS.map((opt) => {
                const on = opt.id === revealScope;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setRevealScope(opt.id)}
                    style={[
                      styles.scopeOption,
                      {
                        borderColor: palette.glassBorder,
                        backgroundColor: palette.glassFill,
                      },
                      on && {
                        borderColor: palette.indigo,
                        backgroundColor: palette.indigoSoft,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons
                      name={on ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={on ? palette.indigo : palette.textTertiary}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="small">{opt.label}</AppText>
                      <AppText variant="caption" color={palette.textTertiary}>
                        {opt.hint}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <AppText variant="caption" color={palette.textTertiary}>
              Link expires after
            </AppText>
            <View style={styles.presets}>
              {SHARE_TTL_PRESETS.map((p) => {
                const on = p.id === ttlId;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setTtlId(p.id)}
                    style={[
                      styles.preset,
                      {
                        borderColor: palette.glassBorder,
                        backgroundColor: palette.glassFill,
                      },
                      on && {
                        backgroundColor: palette.indigo,
                        borderColor: 'rgba(255,255,255,0.35)',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <AppText
                      variant="small"
                      color={on ? palette.textOnAccent : palette.textSecondary}
                    >
                      {p.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText variant="caption" color={palette.textTertiary}>
              Recipient label (optional, only you see this)
            </AppText>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder='e.g. Mom, or "Amazon order"'
              placeholderTextColor={palette.textTertiary}
              style={[
                styles.input,
                {
                  borderColor: palette.glassBorder,
                  backgroundColor: palette.glassFill,
                  color: palette.textPrimary,
                },
              ]}
              maxLength={80}
            />

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="small">Allow only 1 view</AppText>
                <AppText variant="caption" color={palette.textTertiary}>
                  Link stops working after the first successful open
                </AppText>
              </View>
              <Switch
                value={limitViews}
                onValueChange={setLimitViews}
                trackColor={{ true: palette.indigo, false: palette.glassBorder }}
                thumbColor={palette.white}
              />
            </View>

            <PillButton
              label="Create share link"
              icon="link-outline"
              size="lg"
              fullWidth
              onPress={onCreate}
              loading={createShare.isPending}
            />

            <Pressable
              onPress={() =>
                router.push(`/card/${id}/shares` as Href)
              }
              style={styles.manageLink}
            >
              <AppText variant="small" color={palette.indigo}>
                Manage shared links for this card
              </AppText>
            </Pressable>
          </>
        ) : (
          <>
            <GlassCard style={styles.doneCard} padding={spacing.lg}>
              <AppText variant="title">Link ready</AppText>
              <AppText
                variant="caption"
                color={palette.textTertiary}
                selectable
                style={styles.url}
              >
                {created.url}
              </AppText>
              <AppText variant="caption" color={palette.amber}>
                {created.revealScope === 'last_four_only'
                  ? `Recipients see last 4 + expiry only until ${new Date(created.expiresAt).toLocaleString()} or you revoke — CVV is never shared.`
                  : `Anyone with this exact link can view the card number until ${new Date(created.expiresAt).toLocaleString()} or you revoke — treat the full link like a password. CVV is never shared.`}
              </AppText>
            </GlassCard>

            <PillButton
              label="Share link"
              icon="share-outline"
              size="lg"
              fullWidth
              onPress={onNativeShare}
            />
            <PillButton
              label={copied ? 'Copied' : 'Copy link'}
              icon={copied ? 'checkmark' : 'copy-outline'}
              size="lg"
              fullWidth
              variant="ghost"
              onPress={onCopy}
            />
            <PillButton
              label="Manage shares"
              icon="list-outline"
              size="md"
              fullWidth
              variant="ghost"
              onPress={() => router.replace(`/card/${id}/shares` as Href)}
            />
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  warn: { marginTop: spacing.sm },
  warnRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  scopeList: { gap: spacing.sm },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  manageLink: { alignSelf: 'center', paddingVertical: spacing.sm },
  doneCard: { gap: spacing.sm },
  url: { marginVertical: spacing.xs },
});
