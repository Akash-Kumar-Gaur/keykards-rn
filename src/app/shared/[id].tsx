/**
 * In-app "Shared with you" viewer — no KeyKards account required for the
 * payload itself (fetched via public view-card-share). Ciphertext is decrypted
 * on-device with the key from the link fragment (via shareLinkKeyCache).
 * CVV is never shown.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { SharedCardFace } from '@/components/share/SharedCardFace';
import {
  fetchSharedCard,
  type SharedCardPayload,
} from '@/hooks/useCardShares';
import { shareLinkKeyCache } from '@/lib/shareLinkKeyCache';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

export default function SharedWithYouScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<SharedCardPayload | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [message, setMessage] = useState(
    'It may have expired, been revoked by the owner, or reached its view limit.',
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setUnavailable(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      const key = shareLinkKeyCache.peek(id);
      const result = await fetchSharedCard(id, 'app', key);
      if (cancelled) return;
      if (result.ok) {
        setShare(result.share);
        setUnavailable(false);
      } else {
        setShare(null);
        setUnavailable(true);
        setMessage(result.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          hitSlop={12}
          style={styles.back}
        >
          <Ionicons name="close" size={22} color={palette.textPrimary} />
        </Pressable>

        <Eyebrow color={palette.indigo}>Shared with you</Eyebrow>
        <AppText variant="h1">Card details</AppText>

        {loading ? (
          <ActivityIndicator color={palette.indigo} style={{ marginTop: 40 }} />
        ) : unavailable || !share ? (
          <View style={styles.unavailable}>
            <Ionicons
              name="link-outline"
              size={36}
              color={palette.textTertiary}
            />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              This link is no longer available
            </AppText>
            <AppText
              variant="body"
              color={palette.textSecondary}
              style={{ textAlign: 'center' }}
            >
              {message}
            </AppText>
          </View>
        ) : (
          <>
            <AppText variant="body" color={palette.textSecondary}>
              {share.revealScope === 'last_four_only'
                ? 'The sender shared only the last 4 digits and expiry for this card. CVV is never shared.'
                : 'View-only. Tap the number to reveal it on this device. CVV is never shared.'}
            </AppText>
            <SharedCardFace share={share} />
            <AppText variant="caption" color={palette.textTertiary}>
              Expires {new Date(share.expiresAt).toLocaleString()}
            </AppText>
          </>
        )}

        <Pressable
          onPress={() => Linking.openURL('https://keykards.redevolve.in')}
          style={styles.footer}
        >
          <AppText variant="caption" color={palette.textTertiary}>
            Shared securely via KeyKards
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  back: { alignSelf: 'flex-start', marginBottom: spacing.xs },
  unavailable: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
