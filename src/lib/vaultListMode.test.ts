import { vaultListMode } from '@/lib/vaultListMode';

describe('vaultListMode', () => {
  it('always prefers cached cards over network state', () => {
    expect(
      vaultListMode({
        cardCount: 3,
        isPending: true,
        isError: true,
        isSuccess: false,
        fetchStatus: 'paused',
      }),
    ).toBe('list');
  });

  it('does not show empty vault while offline with no cache yet', () => {
    expect(
      vaultListMode({
        cardCount: 0,
        isPending: true,
        isError: false,
        isSuccess: false,
        fetchStatus: 'paused',
      }),
    ).toBe('spinner');
  });

  it('shows empty only after a successful zero-length load', () => {
    expect(
      vaultListMode({
        cardCount: 0,
        isPending: false,
        isError: false,
        isSuccess: true,
        fetchStatus: 'idle',
      }),
    ).toBe('empty');
  });
});
