/**
 * Onboarding slide content — one slide per core module.
 */

import type { Ionicons } from '@expo/vector-icons';

export interface OnboardingSlide {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  headline: string;
  description: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    key: 'vault',
    icon: 'lock-closed-outline',
    eyebrow: 'Vault',
    headline: 'Your cards, secured on this device',
    description:
      'Card numbers are encrypted on this device and revealed only after biometric verification.',
  },
  {
    key: 'track',
    icon: 'stats-chart-outline',
    eyebrow: 'Track',
    headline: "Never miss what you're owed",
    description:
      'Points expiry, annual fees, spend milestones, and subscriptions — tracked in one place.',
  },
  {
    key: 'optimize',
    icon: 'sparkles-outline',
    eyebrow: 'Optimize',
    headline: 'Know which card to swipe',
    description:
      'Smart recommendations before you pay, so every swipe earns the most.',
  },
  {
    key: 'protect',
    icon: 'shield-checkmark-outline',
    eyebrow: 'Protect',
    headline: "Warranties you won't forget",
    description:
      "Purchase protection tracking so coverage doesn't disappear into a drawer.",
  },
];
