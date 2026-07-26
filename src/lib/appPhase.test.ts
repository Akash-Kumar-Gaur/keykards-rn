import { deriveAppPhase } from '@/lib/appPhase';

describe('deriveAppPhase', () => {
  const base = {
    bootReady: true,
    onboardingSeen: true,
    hasSession: false,
    lockEnforced: false,
    unlocked: false,
  };

  it('stays loading until boot is ready', () => {
    expect(deriveAppPhase({ ...base, bootReady: false })).toBe('loading');
  });

  it('shows onboarding before it has been seen', () => {
    expect(deriveAppPhase({ ...base, onboardingSeen: false })).toBe('onboarding');
  });

  it('allows guest Home after onboarding when there is no session', () => {
    expect(deriveAppPhase(base)).toBe('guest');
  });

  it('locks when a session exists and the lock gate is enforced', () => {
    expect(
      deriveAppPhase({
        ...base,
        hasSession: true,
        lockEnforced: true,
        unlocked: false,
      }),
    ).toBe('locked');
  });

  it('unlocks when session + lock cleared', () => {
    expect(
      deriveAppPhase({
        ...base,
        hasSession: true,
        lockEnforced: true,
        unlocked: true,
      }),
    ).toBe('unlocked');
  });
});
