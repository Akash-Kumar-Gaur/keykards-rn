/**
 * Tracks the OS "Reduce Motion" accessibility setting. Animations across the
 * app read this and skip / simplify when it is enabled.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => setReduced(value),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
