/**
 * Share E2E crypto — key stays out of any network payload; round-trip works.
 */

import {
  decryptPanFromShare,
  encryptPanForShare,
  formatPanGroups,
  shareKeyBytesFromB64Url,
} from './shareCrypto';
import { parseShareKeyFromUrl, shareWebUrl } from './cardShare';

describe('shareCrypto E2E', () => {
  it('encrypts under a fresh key and decrypts with that key only', async () => {
    const pan = '4111111111111111';
    const { field, keyB64Url } = await encryptPanForShare(pan);
    expect(field.ciphertext).toBeTruthy();
    expect(field.iv).toBeTruthy();
    expect(field.authTag).toBeTruthy();
    expect(field.ciphertext).not.toContain(pan);

    const raw = shareKeyBytesFromB64Url(keyB64Url);
    expect(raw.length).toBe(32);
    raw.fill(0);

    const digits = await decryptPanFromShare(field, keyB64Url);
    expect(digits).toBe(pan);
    expect(formatPanGroups(digits)).toBe('4111 1111 1111 1111');
  });

  it('puts the key only in the fragment of the share URL', async () => {
    const { keyB64Url } = await encryptPanForShare('4111111111111111');
    const id = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
    const url = shareWebUrl(id, 'https://keykards.redevolve.in', keyB64Url);
    expect(url).toContain(`#k=${keyB64Url}`);
    expect(url.indexOf('#')).toBeGreaterThan(url.indexOf(id));
    // Path/query must not contain the key.
    const withoutHash = url.split('#')[0]!;
    expect(withoutHash).not.toContain(keyB64Url);
    expect(parseShareKeyFromUrl(url)).toBe(keyB64Url);
  });
});
