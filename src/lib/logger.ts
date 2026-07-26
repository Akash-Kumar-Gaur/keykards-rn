/**
 * Safe logger.
 *
 * The ONLY logging path the app should use. Every argument is passed through
 * the redaction utility before it reaches the console (or, later, a crash
 * reporter). This means card-number / CVV / token shaped data can never leak
 * through logs even if a caller is careless.
 *
 * Never call the raw `console.*` directly in feature code — use this.
 */

import { redactArgs } from './redaction';

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, args: unknown[]) {
  const safe = redactArgs(args);
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console[level](...safe);
  }
  // In production, this is where a redacted payload would be forwarded to a
  // crash/analytics sink. Data is already scrubbed at this point.
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};
