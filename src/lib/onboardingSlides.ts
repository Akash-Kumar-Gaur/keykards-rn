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
    headline: 'Add a card — see everything it offers',
    description:
      'Benefits, fees, lounge access, and network — pulled from our catalog the moment you add a card. Encrypted on this device.',
  },
  {
    key: 'optimize',
    icon: 'sparkles-outline',
    eyebrow: 'Smart Swipe',
    headline: 'Know which card to swipe',
    description:
      'Compare reward rates across your wallet by category — dining, fuel, travel — with no spend history required.',
  },
  {
    key: 'track',
    icon: 'checkbox-outline',
    eyebrow: 'Track',
    headline: 'Checklist, renewals, and cover',
    description:
      'Tick lounge visits, see fee dates, and look up purchase protection. Optional imports can automate more later.',
  },
  {
    key: 'protect',
    icon: 'shield-checkmark-outline',
    eyebrow: 'Optional',
    headline: 'Connect only if you want automation',
    description:
      'Clipboard, statements, and Gmail can track spend automatically — never required for KeyKards to be useful.',
  },
];
