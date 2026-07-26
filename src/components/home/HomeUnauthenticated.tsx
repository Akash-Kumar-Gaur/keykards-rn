/**
 * HomeUnauthenticated — trust-first positioning: unified secure card management.
 * Four job-cards with real UI previews + Get started → sign-up.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { ScrollReveal, ScrollRevealProvider } from '@/components/ui/ScrollReveal';
import { Hero } from '@/components/home/Hero';
import { JobPreviewCard, type JobPreview } from '@/components/home/JobPreviewCard';
import { PillButton } from '@/components/ui/PillButton';
import { AppText } from '@/components/ui/AppText';
import { spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

const JOBS: JobPreview[] = [
  {
    kind: 'vault',
    title: 'See every card, instantly',
  },
  {
    kind: 'track',
    title: 'Never miss what\'s due',
  },
  {
    kind: 'add',
    title: 'Add a card in seconds',
  },
  {
    kind: 'trust',
    title: 'Your data never leaves your phone unencrypted',
    trustLine:
      'Full card numbers are encrypted on your device. We never see them, and neither can anyone who breaches our servers.',
  },
];

const HERO_SUBTEXT =
  'See every card instantly, know what\'s due before it\'s late, and add a new one in seconds. No bank app hopping, no typing 16 digits, no photos of your card in your camera roll.';

export function HomeUnauthenticated() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const goSignIn = () => router.push('/sign-in' as Href);
  const goGetStarted = () => router.push('/sign-in?mode=signUp' as Href);

  return (
    <View style={styles.root}>
      <GlowBackground />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => {
          viewportH.value = e.nativeEvent.layout.height;
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + 110,
          },
        ]}
      >
        <ScrollRevealProvider scrollY={scrollY} viewportH={viewportH}>
          <View style={styles.centered}>
            <Hero
              onSignIn={goSignIn}
              signedIn={false}
              subtext={HERO_SUBTEXT}
            />

            {JOBS.map((job, i) => (
              <ScrollReveal
                key={job.kind}
                delay={motion.staggerStep * i}
                style={styles.section}
              >
                <JobPreviewCard job={job} />
              </ScrollReveal>
            ))}

            <ScrollReveal delay={motion.staggerStep * 4} style={styles.ctaSection}>
              <PillButton
                label="Get started"
                icon="arrow-forward"
                variant="primary"
                size="lg"
                fullWidth
                shimmer
                onPress={goGetStarted}
              />
              <AppText variant="small" color={palette.textTertiary} style={styles.helper}>
                Free · takes under a minute
              </AppText>
            </ScrollReveal>
          </View>
        </ScrollRevealProvider>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  centered: {
    gap: spacing.md,
    width: '100%',
  },
  section: { marginTop: spacing.xs },
  ctaSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  helper: { textAlign: 'center' },
});
