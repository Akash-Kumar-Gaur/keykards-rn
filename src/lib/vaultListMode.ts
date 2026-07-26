/**
 * Vault list display mode — keeps offline/cached cards visible and never
 * treats a paused network fetch as an empty vault.
 */

export type VaultListMode = 'spinner' | 'error' | 'empty' | 'list';

export function vaultListMode(args: {
  cardCount: number;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}): VaultListMode {
  const hasCachedCards = args.cardCount > 0;
  if (hasCachedCards) return 'list';
  if (args.isPending && args.fetchStatus === 'fetching') return 'spinner';
  if (args.isError) return 'error';
  if (args.isSuccess) return 'empty';
  // Offline with no hydrate yet — spinner is honest; EmptyVault is not.
  if (args.fetchStatus === 'paused') return 'spinner';
  return 'spinner';
}
