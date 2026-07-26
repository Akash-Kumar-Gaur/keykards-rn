/**
 * Supabase client.
 *
 * Session tokens are persisted via the SecureStore adapter (Keychain /
 * Keystore) — NEVER AsyncStorage. All error surfaces are routed through the
 * redacting logger so no card-shaped / token data can leak through logs.
 *
 * Token refresh runs silently in the background. A refresh failure must never
 * interrupt Vault browsing or biometric reveal — those use the on-device card
 * cache + SecureStore data key.
 */

import 'react-native-url-polyfill/auto';
import { AppState, type AppStateStatus } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStoreAdapter } from './secureStore';
import { logger } from './logger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn(
    'Supabase env not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file. Auth will not work until then.',
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'public-anon-placeholder',
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based session detection in a native app — avoids tokens in URLs.
      detectSessionInUrl: false,
    },
  },
);

/** Expo/RN: pause auto-refresh while backgrounded; resume on foreground. */
let lastAppState: AppStateStatus = AppState.currentState;
AppState.addEventListener('change', (next) => {
  if (lastAppState.match(/inactive|background/) && next === 'active') {
    void supabase.auth.startAutoRefresh();
  } else if (next.match(/inactive|background/)) {
    void supabase.auth.stopAutoRefresh();
  }
  lastAppState = next;
});
