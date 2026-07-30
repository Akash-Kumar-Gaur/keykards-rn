/**
 * Opens inwallet://shared/{id}#k=… (and https …/shared/{id}#k=…) into the
 * in-app viewer. The fragment key is cached in memory (never in the route).
 */

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';
import { parseShareIdFromUrl, parseShareKeyFromUrl } from '@/lib/cardShare';
import { shareLinkKeyCache } from '@/lib/shareLinkKeyCache';

export function ShareDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const open = (url: string | null) => {
      const id = parseShareIdFromUrl(url);
      if (!id) return;
      const key = parseShareKeyFromUrl(url);
      if (key) shareLinkKeyCache.set(id, key);
      router.push(`/shared/${id}` as Href);
    };

    const sub = Linking.addEventListener('url', ({ url }) => open(url));
    return () => sub.remove();
  }, [router]);

  return null;
}
