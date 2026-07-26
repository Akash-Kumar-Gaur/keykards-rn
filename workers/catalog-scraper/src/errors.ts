/**
 * Serialize unknown thrown values for logs (Supabase/OpenAI often throw plain objects).
 */

export function serializeError(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const any = err as Error & { status?: number; code?: string; error?: unknown };
    const parts = [err.message];
    if (any.code) parts.push(`code=${any.code}`);
    if (any.status) parts.push(`status=${any.status}`);
    if (any.error != null) {
      try {
        parts.push(JSON.stringify(any.error));
      } catch {
        /* ignore */
      }
    }
    return parts.filter(Boolean).join(' | ');
  }
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const msg = o.message ?? o.error ?? o.msg;
    if (typeof msg === 'string' && msg.trim()) {
      const code = o.code != null ? ` code=${String(o.code)}` : '';
      const details = o.details != null ? ` details=${String(o.details)}` : '';
      return `${msg}${code}${details}`;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
}
