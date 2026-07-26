/**
 * OCR adapter — pick a screenshot, extract text when a native recognizer is
 * available, otherwise fall back to paste/manual text for the same parser.
 *
 * Full on-device OCR (ML Kit) needs a custom dev client; Expo Go has no OCR.
 */

import { parseAllTransactions, parseTransactionText } from '@/lib/transactionParser';
import type { ParseResult, ParserMatchContext } from '@/types/track';

export type OcrParseInput = {
  /** Text extracted from screenshot (OCR) or typed/pasted by the user. */
  extractedText: string;
  ctx: ParserMatchContext;
};

export type OcrParseOutput = {
  rawText: string;
  /** First successful parse (back-compat). */
  parse: ParseResult;
  parses: ParseResult[];
  /** true when text came from user paste rather than native OCR. */
  usedManualFallback: boolean;
};

/**
 * Run extracted screenshot text through the shared multi-segment parser.
 */
export function parseOcrExtractedText(
  input: OcrParseInput,
  usedManualFallback = false,
): OcrParseOutput {
  const rawText = input.extractedText.trim();
  const parses = parseAllTransactions(rawText, input.ctx);
  if (parses.length === 0) {
    const parse = parseTransactionText(rawText, input.ctx);
    return {
      rawText,
      parse,
      parses: parse.parsed ? [parse] : [],
      usedManualFallback,
    };
  }
  return {
    rawText,
    parse: parses[0],
    parses,
    usedManualFallback,
  };
}

/** Placeholder for wiring ML Kit / Vision later without changing call sites. */
export async function extractTextFromImageUri(
  _imageUri: string,
): Promise<string | null> {
  // Native module not bundled in Phase 3 scaffold — return null so UI
  // shows paste-from-screenshot field. Replace with ML Kit when available.
  return null;
}
