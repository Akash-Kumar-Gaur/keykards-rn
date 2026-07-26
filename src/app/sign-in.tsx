/**
 * Sign in / Sign up — centered, card-themed, interactive.
 *
 * Closable: guests who landed here from onboarding (or tapped Sign in by
 * mistake) can return to signed-out Home without completing auth. That must
 * NOT reset onboarding — markSeen already ran, so Explore/Close → tabs only.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { FloatingCardStack } from '@/components/home/FloatingCardStack';
import { TiltCard } from '@/components/auth/TiltCard';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { AuthModeTabs, AuthMode } from '@/components/auth/AuthModeTabs';
import { spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { isSupabaseConfigured } from '@/lib/supabase';

function initialAuthMode(raw: string | string[] | undefined): AuthMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'signUp' ? 'signUp' : 'signIn';
}

function reasonText(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function SignInScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode: modeParam, reason: reasonParam } = useLocalSearchParams<{
    mode?: string;
    reason?: string;
  }>();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const contextualReason = reasonText(reasonParam);

  const [mode, setMode] = useState<AuthMode>(() => initialAuthMode(modeParam));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Always land on guest Home — never pop into a broken back stack or onboarding. */
  const leaveToHome = () => {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.replace('/(tabs)');
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Sign-in isn’t available right now. Please try again later.');
      return;
    }
    setLoading(true);
    const result =
      mode === 'signIn'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === 'signUp') {
      setNotice('Check your email to confirm your account, then sign in.');
      setMode('signIn');
      return;
    }
    await markSeen();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.navy950 }]}>
      <GlowBackground />
      <FloatingCardStack dim={0.28} style={styles.driftLeft} />
      <FloatingCardStack dim={0.2} style={styles.driftRight} />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        extraKeyboardSpace={12}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={leaveToHome}
            hitSlop={12}
            style={styles.explore}
            accessibilityLabel="Explore without signing in"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color={palette.textSecondary} />
            <AppText variant="small" color={palette.textSecondary}>
              Explore first
            </AppText>
          </Pressable>
          <Pressable
            onPress={leaveToHome}
            hitSlop={12}
            style={styles.close}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={palette.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.centered}>
          <TiltCard />

          <View style={styles.header}>
            <Eyebrow color={palette.indigo}>
              {mode === 'signIn' ? 'Welcome back' : 'Get started'}
            </Eyebrow>
            <AppText variant="h1" style={styles.title}>
              {mode === 'signIn' ? 'Sign in' : 'Create account'}
            </AppText>
            {contextualReason ? (
              <AppText variant="small" color={palette.textSecondary} style={styles.reason}>
                {contextualReason}
              </AppText>
            ) : null}
          </View>

          <AuthModeTabs
            mode={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
          />

          <View style={styles.form}>
            <FloatingLabelField
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <FloatingLabelField
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error ? (
            <AppText variant="small" color={palette.amber} style={styles.message}>
              {error}
            </AppText>
          ) : null}
          {notice ? (
            <AppText variant="small" color={palette.green} style={styles.message}>
              {notice}
            </AppText>
          ) : null}

          <PillButton
            label={mode === 'signIn' ? 'Sign in' : 'Create account'}
            variant="primary"
            size="lg"
            fullWidth
            shimmer
            loading={loading}
            onPress={submit}
            style={styles.submit}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  explore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  close: {
    padding: spacing.xs,
  },
  centered: {
    gap: spacing.lg,
    width: '100%',
  },
  driftLeft: {
    position: 'absolute',
    top: '12%',
    left: -40,
    transform: [{ scale: 0.7 }, { rotate: '-8deg' }],
  },
  driftRight: {
    position: 'absolute',
    bottom: '18%',
    right: -50,
    transform: [{ scale: 0.65 }, { rotate: '12deg' }],
  },
  header: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  title: { marginTop: 2 },
  reason: { marginTop: spacing.xs, lineHeight: 20 },
  form: {
    gap: spacing.md,
  },
  message: { marginTop: -spacing.xs },
  submit: { marginTop: spacing.sm },
});
