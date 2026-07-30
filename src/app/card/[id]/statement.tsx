/**
 * Statement upload + spend summary for a card.
 * PDF is picked, sent to parse-statement edge fn, then discarded locally.
 */

import React, { useMemo, useState } from 'react';
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
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { StatementSummary } from '@/components/statement/StatementSummary';
import { useAuthStore } from '@/stores/authStore';
import { showDialog } from '@/stores/dialogStore';
import { useCard, useCardBenefits } from '@/hooks/useCards';
import {
  StatementParseError,
  useLatestStatement,
  useUploadStatement,
  type StatementProcessResult,
} from '@/hooks/useStatementUpload';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function CardStatementScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: card, isLoading } = useCard(id);
  const { data: benefits = [] } = useCardBenefits(id);
  const { data: latest } = useLatestStatement(id);
  const upload = useUploadStatement(userId);

  const [fresh, setFresh] = useState<StatementProcessResult | null>(null);
  const [isProtected, setIsProtected] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const display = fresh?.import ?? latest ?? null;
  const spendChangePct = useMemo(() => {
    if (fresh) return fresh.spendChangePct;
    if (!latest?.priorPeriodSpend || latest.priorPeriodSpend <= 0) return null;
    return (
      ((latest.totalSpend - latest.priorPeriodSpend) / latest.priorPeriodSpend) *
      100
    );
  }, [fresh, latest]);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/card/${id}` as Href);
  };

  const onUpload = async () => {
    if (!card || !id) return;
    try {
      const result = await upload.mutateAsync({
        cardId: card.id,
        cardNickname: card.nickname,
        bankName: card.bankName,
        lastFour: card.lastFour,
        benefitDescriptions: benefits.map((b) => b.description),
        pdfPassword: isProtected ? pdfPassword : undefined,
      });
      setFresh(result);
      setIsProtected(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'cancelled') return;
      const code = e instanceof StatementParseError ? e.code : null;
      // Password problems: keep the field open so the user can correct it.
      if (code === 'password_required') setIsProtected(true);
      const isPasswordIssue =
        code === 'password_required' || code === 'incorrect_password';
      showDialog({
        title: isPasswordIssue ? 'Password needed' : 'Couldn’t read statement',
        message: msg.slice(0, 200),
        tone: isPasswordIssue ? 'amber' : 'indigo',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
    } finally {
      // SENSITIVE: clear the PDF password from app state on success or failure.
      setPdfPassword('');
      setShowPassword(false);
    }
  };

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm },
        ]}
      >
        <Pressable
          onPress={back}
          hitSlop={12}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Eyebrow color={palette.indigo}>Statement</Eyebrow>
          <AppText variant="title" numberOfLines={1}>
            {card?.nickname ?? 'Card'}
          </AppText>
        </View>
      </View>

      {isLoading || !card ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.indigo} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.huge },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {upload.isPending ? (
            <GlassCard padding={spacing.xl} style={styles.processing}>
              <ActivityIndicator color={palette.indigo} size="large" />
              <AppText variant="title">Reading your statement…</AppText>
              <AppText variant="small" color={palette.textSecondary}>
                PDF stays on-device only long enough to extract — we never keep
                the file.
              </AppText>
            </GlassCard>
          ) : null}

          {!upload.isPending && display ? (
            <StatementSummary data={display} spendChangePct={spendChangePct} />
          ) : null}

          {!upload.isPending && !display ? (
            <GlassCard padding={spacing.xl} style={styles.empty}>
              <IconWrap />
              <AppText variant="h2">Upload a statement</AppText>
              <AppText
                variant="body"
                color={palette.textSecondary}
                style={styles.emptyBody}
              >
                Upload this cycle’s PDF for a spend summary, category split,
                and rewards estimate. It works alongside Gmail and clipboard
                imports; duplicates aren’t added twice.
              </AppText>
            </GlassCard>
          ) : null}

          {!upload.isPending ? (
            <View style={styles.protectBlock}>
              <Pressable
                onPress={() => setIsProtected((v) => !v)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isProtected }}
                accessibilityLabel="This PDF is password-protected"
                hitSlop={8}
              >
                <Ionicons
                  name={isProtected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isProtected ? palette.indigo : palette.textTertiary}
                />
                <AppText variant="body" color={palette.textSecondary}>
                  This PDF is password-protected
                </AppText>
              </Pressable>

              {isProtected ? (
                <View>
                  <View style={styles.passwordWrap}>
                    <FloatingLabelField
                      label="PDF password"
                      icon="lock-closed-outline"
                      value={pdfPassword}
                      onChangeText={setPdfPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="none"
                      importantForAutofill="no"
                      containerStyle={styles.passwordField}
                    />
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={10}
                      style={styles.eyeToggle}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      accessibilityState={{ checked: showPassword }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color={palette.textSecondary}
                      />
                    </Pressable>
                  </View>
                  <AppText
                    variant="caption"
                    color={palette.textTertiary}
                    style={styles.passwordHint}
                  >
                    This is the PDF’s own password (often set by your bank — e.g.
                    first letters of your name + date of birth), not your InWallet
                    PIN. It’s used once to unlock the file and never saved.
                  </AppText>
                </View>
              ) : null}

              <PillButton
                label={display ? 'Upload another PDF' : 'Upload statement PDF'}
                icon="document-text-outline"
                size="lg"
                fullWidth
                onPress={onUpload}
                loading={upload.isPending}
                disabled={isProtected && pdfPassword.trim().length === 0}
              />
            </View>
          ) : null}

          <AppText variant="caption" color={palette.textTertiary} style={styles.fine}>
            PDF is processed then discarded. Account name and partial card number
            from the statement are not logged.
          </AppText>
        </ScrollView>
      )}
    </View>
  );
}

function IconWrap() {
  const palette = usePalette();
  return (
    <View style={[styles.iconWrap, { backgroundColor: palette.indigoSoft }]}>
      <Ionicons name="document-text-outline" size={36} color={palette.indigo} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  processing: { gap: spacing.md, alignItems: 'center' },
  empty: { gap: spacing.md, alignItems: 'flex-start' },
  emptyBody: { marginTop: spacing.xs },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  fine: { textAlign: 'center', paddingHorizontal: spacing.md },
  protectBlock: { gap: spacing.md },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  passwordWrap: {
    position: 'relative',
    borderRadius: radius.md,
  },
  passwordField: { paddingRight: 44 },
  eyeToggle: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 2,
  },
  passwordHint: {
    marginTop: spacing.xs,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
  },
});
