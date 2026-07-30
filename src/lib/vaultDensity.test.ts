/**
 * Vault list geometry helpers.
 */

import {
  VAULT_ROW_GAP,
  VAULT_ROW_HEIGHT,
  vaultRowStagger,
} from './vaultDensity';

describe('vault list geometry', () => {
  it('uses one fixed row height for every count', () => {
    expect(VAULT_ROW_HEIGHT).toBe(96);
    expect(VAULT_ROW_GAP).toBeGreaterThan(0);
  });

  it('staggers entrances then caps for long lists', () => {
    expect(vaultRowStagger(0)).toBe(0);
    expect(vaultRowStagger(1)).toBe(70);
    expect(vaultRowStagger(3)).toBe(210);
    expect(vaultRowStagger(40)).toBe(vaultRowStagger(12));
  });
});
