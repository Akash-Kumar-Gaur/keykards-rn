/**
 * expo-secure-store wrapper.
 *
 * Backed by the iOS Keychain / Android Keystore. This is the ONLY place the
 * app persists secrets: the per-user AES data key and Supabase session tokens.
 * Nothing sensitive is ever written to AsyncStorage or a persisted store.
 */

import * as SecureStore from 'expo-secure-store';

export const SECURE_KEYS = {
  /** Per-user AES-256-GCM data key (base64). Never leaves the device. */
  dataKey: 'keykards.dataKey.v1',
  /** Supabase session, persisted here instead of AsyncStorage. */
  supabaseSession: 'keykards.supabase.session',
  /** Whether the user has completed first-run setup. */
  onboarded: 'keykards.onboarded',
  /**
   * Owner-only map of shareId → share key (base64url) for rebuilding `#k=`
   * links on this device. Never uploaded.
   */
  shareLinkKeys: 'keykards.shareLinkKeys.v1',
  /** Per-user map of dismissed "add your name" nudges (JSON object). */
  nameNudgeDismissed: 'keykards.nameNudge.dismissed.v1',
} as const;

const options: SecureStore.SecureStoreOptions = {
  // Available after first unlock; not backed up to iCloud/Keychain sync.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key, options);
}

export async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, options);
}

export async function secureDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key, options);
}

/**
 * Storage adapter conforming to Supabase's async storage interface, backed by
 * SecureStore. SecureStore has a ~2KB value limit; Supabase sessions can be
 * larger, so we chunk transparently.
 */
const CHUNK_SIZE = 1800;

export const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const meta = await secureGet(key);
    if (meta === null) return null;
    if (!meta.startsWith('__chunks__:')) return meta;
    const count = parseInt(meta.slice('__chunks__:'.length), 10);
    let value = '';
    for (let i = 0; i < count; i++) {
      const part = await secureGet(`${key}.${i}`);
      if (part === null) return null;
      value += part;
    }
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await secureSet(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    await secureSet(key, `__chunks__:${count}`);
    for (let i = 0; i < count; i++) {
      await secureSet(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const meta = await secureGet(key);
    if (meta && meta.startsWith('__chunks__:')) {
      const count = parseInt(meta.slice('__chunks__:'.length), 10);
      for (let i = 0; i < count; i++) {
        await secureDelete(`${key}.${i}`);
      }
    }
    await secureDelete(key);
  },
};
