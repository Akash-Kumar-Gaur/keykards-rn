/**
 * Hero — brand row + floating card stack + animated headline.
 * Vertically compact so Home can center the whole composition.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Eyebrow } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { AnimatedEntrance } from '@/components/ui/AnimatedEntrance';
import { FloatingCardStack } from '@/components/home/FloatingCardStack';
import { AnimatedHeadline } from '@/components/home/AnimatedHeadline';
import { spacing, motion } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';

interface HeroProps {
  onSignIn: () => void;
  signedIn?: boolean;
  subtext?: string;
}

export function Hero({
  onSignIn,
  signedIn = false,
  subtext,
}: HeroProps) {
  const palette = usePalette();
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <AnimatedEntrance delay={0}>
          <View style={styles.brandBlock}>
            <Eyebrow color={palette.indigo}>
              {signedIn ? 'Your wallet, upgraded' : 'All your cards, secured'}
            </Eyebrow>
            <AppText variant="title" style={styles.appName}>
              KeyKards
            </AppText>
          </View>
        </AnimatedEntrance>
        <AnimatedEntrance delay={motion.staggerStep}>
          <PillButton
            label={signedIn ? 'Account' : 'Sign in'}
            variant="ghost"
            size="sm"
            onPress={onSignIn}
          />
        </AnimatedEntrance>
      </View>

      <View style={styles.stage}>
        <FloatingCardStack style={styles.stack} />
        <View style={styles.headlineLayer}>
          <AnimatedHeadline startDelay={480} subtext={subtext} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandBlock: {
    gap: spacing.xs,
  },
  appName: {
    marginTop: 4,
    letterSpacing: 0.4,
  },
  stage: {
    marginTop: spacing.sm,
    minHeight: 200,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  stack: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    opacity: 0.95,
  },
  headlineLayer: {
    marginTop: 108,
    zIndex: 2,
  },
});
