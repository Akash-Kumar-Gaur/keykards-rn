/**
 * Unit tests for the AES-256-GCM crypto core. Runs under Node's native
 * WebCrypto — no device / Expo runtime needed.
 */

import {
  base64ToBytes,
  bytesToBase64,
  decryptWithKey,
  encryptWithKey,
  generateRawKey,
  importAesKey,
  CRYPTO_CONSTANTS,
} from './core';

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    for (const len of [0, 1, 2, 3, 16, 31, 32, 100]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 31 + 7) & 255;
      const b64 = bytesToBase64(bytes);
      const back = base64ToBytes(b64);
      expect(Array.from(back)).toEqual(Array.from(bytes));
    }
  });

  it('produces standard base64 (matches Buffer)', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('key generation', () => {
  it('generates 256-bit keys', () => {
    const key = generateRawKey();
    expect(key.length).toBe(CRYPTO_CONSTANTS.KEY_LENGTH_BYTES);
    expect(key.length).toBe(32);
  });

  it('generates unique keys', () => {
    const a = bytesToBase64(generateRawKey());
    const b = bytesToBase64(generateRawKey());
    expect(a).not.toBe(b);
  });

  it('rejects wrong-length keys on import', async () => {
    await expect(importAesKey(new Uint8Array(16))).rejects.toThrow();
  });
});

describe('encrypt / decrypt', () => {
  it('round-trips plaintext', async () => {
    const key = generateRawKey();
    const plaintext = '4111 1111 1111 1111';
    const enc = await encryptWithKey(plaintext, key);
    expect(enc.ciphertext).toBeTruthy();
    expect(enc.iv).toBeTruthy();
    expect(enc.authTag).toBeTruthy();
    // Ciphertext must not contain the plaintext.
    expect(enc.ciphertext).not.toContain('4111');
    const dec = await decryptWithKey(enc, key);
    expect(dec).toBe(plaintext);
  });

  it('uses a fresh IV each time (different ciphertext for same input)', async () => {
    const key = generateRawKey();
    const a = await encryptWithKey('secret', key);
    const b = await encryptWithKey('secret', key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('produces a 12-byte IV and 16-byte auth tag', async () => {
    const key = generateRawKey();
    const enc = await encryptWithKey('x', key);
    expect(base64ToBytes(enc.iv).length).toBe(CRYPTO_CONSTANTS.IV_LENGTH_BYTES);
    expect(base64ToBytes(enc.authTag).length).toBe(CRYPTO_CONSTANTS.AUTH_TAG_LENGTH_BYTES);
  });

  it('fails to decrypt with the wrong key', async () => {
    const enc = await encryptWithKey('secret', generateRawKey());
    await expect(decryptWithKey(enc, generateRawKey())).rejects.toThrow();
  });

  it('fails to decrypt a tampered auth tag', async () => {
    const key = generateRawKey();
    const enc = await encryptWithKey('secret', key);
    const tag = base64ToBytes(enc.authTag);
    tag[0] ^= 0xff;
    await expect(
      decryptWithKey({ ...enc, authTag: bytesToBase64(tag) }, key),
    ).rejects.toThrow();
  });

  it('handles unicode plaintext', async () => {
    const key = generateRawKey();
    const plaintext = 'नमस्ते · 卡 · 💳';
    const enc = await encryptWithKey(plaintext, key);
    expect(await decryptWithKey(enc, key)).toBe(plaintext);
  });
});
