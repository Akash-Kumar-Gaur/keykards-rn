/**
 * Optional PNG overrides (prefer NETWORK_SVG in networkMarks.ts).
 * Kept so drop-in PNGs from official brand kits can still be registered.
 */

import type { CardNetwork } from '@/types/card';
import type { ImageSourcePropType } from 'react-native';

export const NETWORK_OFFICIAL_ASSETS: Partial<
  Record<CardNetwork, ImageSourcePropType>
> = {};

export function hasOfficialNetworkAsset(network: CardNetwork): boolean {
  return NETWORK_OFFICIAL_ASSETS[network] != null;
}
