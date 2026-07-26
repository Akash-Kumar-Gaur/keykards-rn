/**
 * Auth store (Zustand).
 *
 * Mirrors the Supabase auth session for the UI. This store is NOT persisted to
 * disk — the source of truth for the session is Supabase, which persists tokens
 * in SecureStore. We only keep a lightweight in-memory reflection here.
 */

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface AuthState {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  setSession: (session: Session | null) => void;
  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  initializing: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),

  init: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      set({ session: data.session, user: data.session?.user ?? null });
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    } catch (err) {
      logger.error('Failed to initialize auth session', err);
    } finally {
      set({ initializing: false });
    }
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      logger.warn('Sign up failed', error);
      return { error: error.message };
    }
    return {};
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logger.warn('Sign in failed', error);
      return { error: error.message };
    }
    return {};
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) logger.warn('Sign out failed', error);
    set({ session: null, user: null });
  },
}));
