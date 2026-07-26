/**
 * Clipboard adapter — thin: read clipboard, heuristic gate, hand off to parser.
 * Supports multi-snippet pastes via parseAllTransactions.
 */

import * as Clipboard from 'expo-clipboard';
import {
  looksLikeTransaction,
  parseAllTransactions,
  parseTransactionText,
} from '@/lib/transactionParser';
import type { ParseResult, ParserMatchContext } from '@/types/track';

export type ClipboardCandidate = {
  rawText: string;
  /** @deprecated Prefer `parses` — first successful parse for back-compat. */
  parse: ParseResult;
  parses: ParseResult[];
};

export async function readClipboardTransactionCandidate(
  ctx: ParserMatchContext,
): Promise<ClipboardCandidate | null> {
  const rawText = (await Clipboard.getStringAsync())?.trim() ?? '';
  if (!looksLikeTransaction(rawText)) return null;
  const parses = parseAllTransactions(rawText, ctx);
  if (parses.length === 0) {
    // Fall back to single-pass for edge cases the splitter over-fragments.
    const parse = parseTransactionText(rawText, ctx);
    if (!parse.parsed) return null;
    return { rawText, parse, parses: [parse] };
  }
  return { rawText, parse: parses[0], parses };
}
