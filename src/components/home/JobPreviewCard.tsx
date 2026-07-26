/**
 * JobPreviewCard — signed-out Home “jobs” teaser.
 * Benefit-first line + cropped preview of real Vault / Track / NFC / flip UI.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { AppText } from '@/components/ui/AppText';
import { IconBadge } from '@/components/ui/IconBadge';
import { RadialProgress } from '@/components/ui/RadialProgress';
import { CardFace } from '@/components/vault/CardFace';
import { CardThemeGlow } from '@/components/vault/CardThemeGlow';
import { NfcPulseRings } from '@/components/vault/NfcPulseRings';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export type JobPreviewKind = 'vault' | 'track' | 'add' | 'trust';

export interface JobPreview {
  kind: JobPreviewKind;
  title: string;
  /** Trust statement only — shown under the flip preview. */
  trustLine?: string;
}

function VaultListPreview() {
  return (
    <View style={styles.vaultPreview}>
      <View style={styles.spotlightWrap}>
        <CardThemeGlow themeId="generic-violet" width={220} height={128} />
        <View style={styles.spotlightClip}>
          <CardFace
            nickname="Travel"
            bankName="Your bank"
            network="Visa"
            lastFour="4242"
            themeId="generic-violet"
            expiryMonth={8}
            expiryYear={28}
            variant="compact"
            elevate={false}
          />
        </View>
      </View>
      <View style={[styles.spotlightWrap, styles.vaultSecond]}>
        <CardThemeGlow themeId="generic-slate" width={200} height={112} />
        <View style={styles.spotlightClip}>
          <CardFace
            nickname="Everyday"
            bankName="Your bank"
            network="Mastercard"
            lastFour="8891"
            themeId="generic-slate"
            expiryMonth={3}
            expiryYear={29}
            variant="mini"
            elevate={false}
          />
        </View>
      </View>
    </View>
  );
}

function TrackDuePreview() {
  const palette = usePalette();
  return (
    <View style={styles.trackPreview}>
      <GlassCard padding={spacing.md} style={styles.trackTile}>
        <View style={styles.trackMilestone}>
          <RadialProgress progress={0.72} size={64} strokeWidth={7} play>
            <AppText variant="caption" color={palette.textPrimary}>
              72%
            </AppText>
          </RadialProgress>
          <View style={styles.trackMeta}>
            <AppText variant="small" numberOfLines={1}>
              Milestone
            </AppText>
            <AppText variant="caption" color={palette.textTertiary} numberOfLines={1}>
              Progress toward fee waiver
            </AppText>
          </View>
        </View>
      </GlassCard>
      <GlassCard padding={spacing.md} style={styles.trackTile}>
        <IconBadge icon="calendar-outline" tone="amber" size={28} />
        <AppText variant="small" numberOfLines={1}>
          Annual fee
        </AppText>
        <AppText variant="title" numberOfLines={1}>
          Aug 12
        </AppText>
        <AppText variant="caption" color={palette.textSecondary}>
          in 17d
        </AppText>
      </GlassCard>
    </View>
  );
}

function AddCardPreview() {
  const palette = usePalette();
  return (
    <View style={styles.addPreview}>
      <View style={styles.nfcScale}>
        <NfcPulseRings />
      </View>
      <AppText variant="caption" color={palette.textTertiary} style={styles.addCaption}>
        Tap to read · or enter manually
      </AppText>
    </View>
  );
}

function FlipTrustPreview() {
  return (
    <View style={styles.flipPreview}>
      <View style={styles.flipStack}>
        <View style={[styles.flipFace, styles.flipFront]}>
          <CardFace
            nickname="Travel"
            bankName="Your bank"
            network="Visa"
            lastFour="4242"
            themeId="midnight"
            expiryMonth={8}
            expiryYear={28}
            variant="mini"
            hint="Biometric to reveal"
            elevate={false}
          />
        </View>
        <View style={[styles.flipFace, styles.flipBack]}>
          <CardFace
            nickname="Travel"
            bankName="Your bank"
            network="Visa"
            lastFour="4242"
            themeId="midnight"
            expiryMonth={8}
            expiryYear={28}
            variant="back"
            revealedNumber="4111111111114242"
            activeField="number"
            hasCvv
            elevate={false}
          />
        </View>
      </View>
    </View>
  );
}

function Preview({ kind }: { kind: JobPreviewKind }) {
  switch (kind) {
    case 'vault':
      return <VaultListPreview />;
    case 'track':
      return <TrackDuePreview />;
    case 'add':
      return <AddCardPreview />;
    case 'trust':
      return <FlipTrustPreview />;
  }
}

export function JobPreviewCard({ job }: { job: JobPreview }) {
  const palette = usePalette();
  return (
    <GlassCard padding={spacing.lg} style={styles.card}>
      <AppText variant="title" style={styles.title}>
        {job.title}
      </AppText>
      <View
        style={[
          styles.previewFrame,
          {
            backgroundColor: palette.navy900,
            borderColor: palette.glassBorder,
          },
        ]}
        pointerEvents="none"
      >
        <Preview kind={job.kind} />
      </View>
      {job.trustLine ? (
        <AppText variant="small" color={palette.textSecondary} style={styles.trust}>
          {job.trustLine}
        </AppText>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  title: {
    marginBottom: 2,
  },
  previewFrame: {
    height: 148,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
  },
  trust: {
    lineHeight: 20,
  },
  vaultPreview: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  spotlightWrap: {
    position: 'relative',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 240,
  },
  vaultSecond: {
    marginTop: -28,
    marginLeft: 28,
    opacity: 0.92,
    transform: [{ scale: 0.92 }],
  },
  spotlightClip: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  trackPreview: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'stretch',
  },
  trackTile: {
    flex: 1,
    gap: spacing.xs,
  },
  trackMilestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trackMeta: {
    flex: 1,
    gap: 2,
  },
  addPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  nfcScale: {
    transform: [{ scale: 0.52 }],
    marginVertical: -56,
  },
  addCaption: {
    marginTop: 4,
  },
  flipPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  flipStack: {
    width: 220,
    height: 120,
    position: 'relative',
  },
  flipFace: {
    position: 'absolute',
    width: 168,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  flipFront: {
    left: 0,
    top: 8,
    transform: [{ rotate: '-6deg' }],
    zIndex: 1,
  },
  flipBack: {
    right: 0,
    top: 0,
    transform: [{ rotate: '8deg' }],
    zIndex: 2,
    opacity: 0.98,
  },
});
