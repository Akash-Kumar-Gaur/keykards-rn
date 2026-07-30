/**
 * Onboarding carousel — first launch only.
 *
 * Full-screen swipeable slides (edge-to-edge). Skip + footer float over the
 * carousel so each slide uses the whole viewport, not a centered mid band.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Carousel, type CarouselRef } from 'react-native-reanimated-carousel';
import { Ionicons } from '@expo/vector-icons';
import { GlowBackground } from '@/components/ui/GlowBackground';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { ONBOARDING_SLIDES, OnboardingSlide } from '@/lib/onboardingSlides';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { spacing, radius } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

function Slide({
  item,
  topPad,
  bottomPad,
}: {
  item: OnboardingSlide;
  topPad: number;
  bottomPad: number;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.slide, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.slideInner}>
        <View style={[styles.iconCircle, { backgroundColor: palette.indigoSoft }]}>
          <Ionicons name={item.icon} size={44} color={palette.indigo} />
        </View>
        <Eyebrow color={palette.indigo}>{item.eyebrow}</Eyebrow>
        <AppText variant="h1" style={styles.headline}>
          {item.headline}
        </AppText>
        <AppText variant="bodyLg" color={palette.textSecondary} style={styles.description}>
          {item.description}
        </AppText>
      </View>
    </View>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  const palette = usePalette();
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: palette.glassBorderStrong },
            i === index && { width: 22, backgroundColor: palette.indigo },
          ]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduced = useReducedMotion();
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const { width, height } = useWindowDimensions();
  const carouselRef = useRef<CarouselRef>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === ONBOARDING_SLIDES.length - 1;

  const topBarHeight = insets.top + spacing.sm + 36;
  const footerHeight = 168 + insets.bottom;
  const slideTopPad = topBarHeight + spacing.xl;
  const slideBottomPad = footerHeight + spacing.lg;

  const finish = useCallback(async () => {
    await markSeen();
    // Nudge into auth, but Sign in is closable → signed-out Home (guest).
    router.replace('/sign-in?mode=signUp' as Href);
  }, [markSeen, router]);

  const skip = useCallback(async () => {
    await markSeen();
    router.replace('/(tabs)');
  }, [markSeen, router]);

  const next = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    carouselRef.current?.scrollTo({ index: index + 1, animated: !reduced });
  }, [finish, index, isLast, reduced]);

  return (
    <View style={[styles.root, { backgroundColor: palette.navy950 }]}>
      <GlowBackground />

      <Carousel
        ref={carouselRef}
        data={ONBOARDING_SLIDES}
        loop={false}
        itemSize={width}
        snapMode="page"
        style={[styles.carousel, { width, height }]}
        contentContainerStyle={styles.carousel}
        layout={reduced ? undefined : { type: 'parallax', scale: 0.94, offset: 28 }}
        animation={{ type: 'timing', duration: reduced ? 0 : 450 }}
        onSnapToItem={setIndex}
        renderItem={({ item }) => (
          <Slide item={item} topPad={slideTopPad} bottomPad={slideBottomPad} />
        )}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Pressable onPress={skip} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip">
          <AppText variant="body" color={palette.textSecondary}>
            Skip
          </AppText>
        </Pressable>
      </View>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}
        pointerEvents="box-none"
      >
        <Dots count={ONBOARDING_SLIDES.length} index={index} />
        <PillButton
          label={isLast ? 'Get started' : 'Continue'}
          variant="primary"
          size="lg"
          fullWidth
          onPress={next}
          style={styles.cta}
        />
        {isLast ? (
          <Pressable onPress={finish} style={styles.signInLink}>
            <AppText variant="small" color={palette.textSecondary}>
              Already have an account?{' '}
            </AppText>
            <AppText variant="small" color={palette.indigo}>
              Sign in
            </AppText>
          </Pressable>
        ) : (
          <Pressable onPress={next} style={styles.signInLink}>
            <AppText variant="small" color={palette.textTertiary}>
              Swipe or tap to advance
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  carousel: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  slide: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
  },
  slideInner: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    maxWidth: 420,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headline: {
    lineHeight: 38,
  },
  description: {
    lineHeight: 24,
    maxWidth: '95%',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    zIndex: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  cta: { marginTop: spacing.xs },
  signInLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
});
