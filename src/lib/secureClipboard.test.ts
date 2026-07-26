/**
 * Unit tests for secure clipboard conditional-clear contract.
 * Native Clipboard is mocked — we verify we only clear when contents match.
 */

const setStringAsync = jest.fn(async (_v: string) => undefined);
const getStringAsync = jest.fn(async () => '');

jest.mock('expo-clipboard', () => ({
  setStringAsync: (v: string) => setStringAsync(v),
  getStringAsync: () => getStringAsync(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  CLIPBOARD_CLEAR_MS,
  copyWithConditionalClear,
} from './secureClipboard';

describe('copyWithConditionalClear', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setStringAsync.mockClear();
    getStringAsync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('copies then clears only if clipboard still matches', async () => {
    const secret = '4111111111111111';
    getStringAsync.mockResolvedValue(secret);

    await copyWithConditionalClear(secret, 1000);
    expect(setStringAsync).toHaveBeenCalledWith(secret);

    await jest.advanceTimersByTimeAsync(1000);
    expect(getStringAsync).toHaveBeenCalled();
    expect(setStringAsync).toHaveBeenLastCalledWith('');
  });

  it('does not clear when clipboard contents changed', async () => {
    const secret = '4111111111111111';
    getStringAsync.mockResolvedValue('something-else');

    await copyWithConditionalClear(secret, 1000);
    setStringAsync.mockClear();

    await jest.advanceTimersByTimeAsync(1000);
    expect(getStringAsync).toHaveBeenCalled();
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  it('exports 30s default TTL', () => {
    expect(CLIPBOARD_CLEAR_MS).toBe(30_000);
  });
});
