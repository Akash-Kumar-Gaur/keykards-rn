/**
 * Home route — hard auth-state split.
 *
 * Renders HomeAuthenticated XOR HomeUnauthenticated. Never mixes mock
 * dashboard numbers into a signed-in view, and never shows real-looking
 * stats while signed out.
 */

import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { HomeAuthenticated } from '@/components/home/HomeAuthenticated';
import { HomeUnauthenticated } from '@/components/home/HomeUnauthenticated';

export default function HomeScreen() {
  const session = useAuthStore((s) => s.session);
  if (session) return <HomeAuthenticated />;
  return <HomeUnauthenticated />;
}
