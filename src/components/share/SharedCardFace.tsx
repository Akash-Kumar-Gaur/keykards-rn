/**
 * SharedCardFace — recipient card view (app).
 * CVV is never shown.
 * - reveal_scope 'full': masked by default, tap to reveal full number.
 * - reveal_scope 'last_four_only': shows last 4 directly — no dead reveal affordance.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/AppText';
import { NetworkBadge } from '@/components/vault/NetworkBadge';
import { CardMaterialOverlay } from '@/components/vault/CardMaterialOverlay';
import { getCardTheme } from '@/lib/cardThemes';
import { formatExpiry } from '@/lib/cardUtils';
import { palette, radius, spacing } from '@/theme';
import { useCardCanvasElevation } from '@/hooks/useCardCanvasElevation';
import type { CardColorTheme, CardNetwork } from '@/types/card';
import type { SharedCardPayload } from '@/hooks/useCardShares';

export function SharedCardFace({ share }: { share: SharedCardPayload }) {
  const [revealed, setRevealed] = useState(false);
  const canvasElevation = useCardCanvasElevation();
  const theme = getCardTheme(share.cardColorTheme as CardColorTheme);
  const lastFourOnly = share.revealScope === 'last_four_only' || !share.numberFull;
  const displayNumber = lastFourOnly
    ? share.numberMasked
    : revealed
      ? share.numberFull!
      : share.numberMasked;

  return (
    <View
      style={[
        styles.elevatePlate,
        { backgroundColor: theme.colors[0] },
        canvasElevation,
      ]}
    >
      <LinearGradient
        colors={[...theme.colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <CardMaterialOverlay />
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.7)"
              style={styles.bank}
              numberOfLines={1}
            >
              {share.bankName}
            </AppText>
            <AppText variant="title" color={palette.white} numberOfLines={1}>
              {share.nickname}
            </AppText>
          </View>
          <NetworkBadge
            network={share.network as CardNetwork}
            size="md"
            contrast="onDark"
          />
        </View>

        <View style={styles.midRow}>
          <View style={styles.chip} />
        </View>

        {lastFourOnly ? (
          <View style={styles.numberRow} accessibilityLabel="Last four digits">
            <AppText
              variant="bodyLg"
              color={palette.white}
              style={[styles.number, styles.embossed]}
            >
              {displayNumber}
            </AppText>
          </View>
        ) : (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              revealed ? 'Hide card number' : 'Show card number'
            }
            style={styles.numberRow}
          >
          <AppText variant="bodyLg" color={palette.white} style={[styles.number, styles.embossed]}>
            {displayNumber}
          </AppText>
          <Ionicons
            name={revealed ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color="rgba(255,255,255,0.85)"
          />
        </Pressable>
      )}

      {share.cardholderName?.trim() ? (
        <AppText
          variant="small"
          color={palette.white}
          style={[styles.holderName, styles.embossed]}
          numberOfLines={1}
        >
          {share.cardholderName.trim()}
        </AppText>
      ) : null}

      <View style={styles.bottomRow}>
        <AppText variant="caption" color="rgba(255,255,255,0.75)">
          EXP {formatExpiry(share.expiryMonth, share.expiryYear)}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.55)">
          CVV not shared
        </AppText>
      </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  elevatePlate: {
    width: '100%',
    borderRadius: radius.xl,
  },
  card: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topLeft: { flex: 1, minWidth: 0 },
  bank: { textTransform: 'uppercase', letterSpacing: 1 },
  midRow: { marginVertical: spacing.sm },
  chip: {
    width: 42,
    height: 30,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 198, 90, 0.85)',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  number: {
    flex: 1,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  embossed: {
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  holderName: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
