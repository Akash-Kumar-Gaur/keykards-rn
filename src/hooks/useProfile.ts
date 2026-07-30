/**
 * Profile display name — canonical source is public.profiles.display_name.
 * Shared React Query cache so Home greeting + Account initials stay in sync.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  normalizeDisplayName,
  validateDisplayNameInput,
} from '@/lib/displayName';

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
};

export type ProfileRow = {
  displayName: string | null;
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId!)
        .maybeSingle();
      if (error) {
        logger.warn('Failed to load profile', error);
        throw error;
      }
      return {
        displayName:
          typeof data?.display_name === 'string' ? data.display_name : null,
      };
    },
  });
}

/**
 * Lightweight name update — profiles row + auth metadata mirror.
 * No biometric; invalidates the shared profile query for Home + Account.
 */
export function useUpdateDisplayName(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rawName: string): Promise<string> => {
      if (!userId) throw new Error('Sign in to save your name.');
      const validation = validateDisplayNameInput(rawName);
      if (validation) throw new Error(validation);
      const displayName = normalizeDisplayName(rawName);

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, display_name: displayName },
          { onConflict: 'id' },
        );
      if (profileError) {
        logger.warn('Failed to update profile display_name', profileError);
        throw profileError;
      }

      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: displayName },
      });
      if (metaError) {
        // Profile row is source of truth; metadata is a best-effort mirror.
        logger.warn('Failed to mirror full_name to auth metadata', metaError);
      }

      return displayName;
    },
    onSuccess: (displayName) => {
      if (!userId) return;
      qc.setQueryData<ProfileRow>(profileKeys.detail(userId), { displayName });
      void qc.invalidateQueries({ queryKey: profileKeys.detail(userId) });
    },
  });
}
