/**
 * Statement upload: pick PDF → edge function extract/structure → dedupe merge
 * → persist summary + new txns. PDF bytes never leave this session after the
 * function returns (not written to Storage).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  buildCategoryBreakdown,
  estimateRewardPoints,
  pickNotableTransactions,
  planStatementMerge,
  type CategoryBreakdown,
} from '@/lib/statementMerge';
import type { StatementExtraction, StatementLineItem } from '@/lib/statementParse';
import {
  mapTransactionRow,
  TRANSACTION_SELECT,
  type TransactionRow,
} from '@/lib/trackMappers';
import { trackKeys } from '@/hooks/useTransactions';
import type { VaultTransaction } from '@/types/track';

export type StatementImportRow = {
  id: string;
  userId: string;
  cardId: string;
  periodStart: string;
  periodEnd: string;
  totalSpend: number;
  minimumDue: number | null;
  totalDue: number | null;
  rewardPointsEarned: number | null;
  rewardPointsSource: 'statement' | 'estimated';
  categoryBreakdown: CategoryBreakdown;
  notableTransactions: StatementLineItem[];
  lineItems: StatementLineItem[];
  paymentDueDate: string | null;
  lineItemCount: number;
  newTxnCount: number;
  matchedTxnCount: number;
  priorPeriodSpend: number | null;
  extractionMethod: 'pdf_text' | 'pdf_document_fallback';
  createdAt: string;
};

export type StatementProcessResult = {
  import: StatementImportRow;
  spendChangePct: number | null;
};

const statementKeys = {
  latest: (cardId: string) => ['statements', 'latest', cardId] as const,
  list: (cardId: string) => ['statements', 'list', cardId] as const,
};

function mapImport(row: Record<string, unknown>): StatementImportRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    cardId: String(row.card_id),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    totalSpend: Number(row.total_spend) || 0,
    minimumDue: row.minimum_due == null ? null : Number(row.minimum_due),
    totalDue: row.total_due == null ? null : Number(row.total_due),
    rewardPointsEarned:
      row.reward_points_earned == null ? null : Number(row.reward_points_earned),
    rewardPointsSource:
      row.reward_points_source === 'statement' ? 'statement' : 'estimated',
    categoryBreakdown: (row.category_breakdown as CategoryBreakdown) ?? {},
    notableTransactions:
      (row.notable_transactions as StatementLineItem[]) ?? [],
    lineItems: (row.line_items as StatementLineItem[]) ?? [],
    paymentDueDate:
      row.payment_due_date == null ? null : String(row.payment_due_date),
    lineItemCount: Number(row.line_item_count) || 0,
    newTxnCount: Number(row.new_txn_count) || 0,
    matchedTxnCount: Number(row.matched_txn_count) || 0,
    priorPeriodSpend:
      row.prior_period_spend == null ? null : Number(row.prior_period_spend),
    extractionMethod:
      row.extraction_method === 'pdf_document_fallback'
        ? 'pdf_document_fallback'
        : 'pdf_text',
    createdAt: String(row.created_at),
  };
}

async function pickStatementPdf(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.mimeType && asset.mimeType !== 'application/pdf') {
    throw new Error('Please choose a PDF statement.');
  }
  return { uri: asset.uri, name: asset.name ?? 'statement.pdf' };
}

async function readPdfBase64(uri: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return b64;
}

/**
 * Carries the edge function's structured error `code` so the UI can react
 * (e.g. keep the password field open on a password error). `.message` is always
 * safe to show verbatim in a themed dialog.
 */
export class StatementParseError extends Error {
  code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'StatementParseError';
    this.code = code;
  }
}

const GENERIC_PARSE_MESSAGE = 'Could not read this statement. Please try again.';

/**
 * Pull the structured `{ code, message }` body out of a failed invoke.
 * supabase-js collapses any non-2xx into a FunctionsHttpError whose `.message`
 * is the opaque "Edge Function returned a non-2xx status code" — the real,
 * stage-specific error lives in `error.context` (the raw Response). Reading it
 * here is what turns a bare HTTP failure into a precise, user-facing message.
 */
async function readInvokeError(
  error: unknown,
): Promise<{ code: string | null; message: string }> {
  const ctx = (error as { context?: unknown })?.context;
  const res = ctx as { json?: () => Promise<unknown> } | undefined;
  if (res && typeof res.json === 'function') {
    try {
      const body = (await res.json()) as { code?: string; message?: string };
      if (body && (body.message || body.code)) {
        return {
          code: body.code ?? null,
          message: body.message || GENERIC_PARSE_MESSAGE,
        };
      }
    } catch {
      /* body wasn't JSON (e.g. a 404 when the function isn't deployed) */
    }
  }
  const msg = error instanceof Error ? error.message : '';
  return { code: null, message: msg || GENERIC_PARSE_MESSAGE };
}

async function invokeParseStatement(args: {
  pdfBase64: string;
  cardId: string;
  cardNickname: string;
  bankName: string;
  lastFour: string;
  password?: string;
}): Promise<{
  extraction: StatementExtraction;
  extractionMethod: 'pdf_text' | 'pdf_document_fallback';
}> {
  const { data, error } = await supabase.functions.invoke('parse-statement', {
    body: {
      pdfBase64: args.pdfBase64,
      cardId: args.cardId,
      cardNickname: args.cardNickname,
      bankName: args.bankName,
      lastFour: args.lastFour,
      // SENSITIVE: PDF password travels only with this request; never persisted.
      ...(args.password ? { password: args.password } : {}),
    },
  });

  if (error) {
    const { code, message } = await readInvokeError(error);
    // Never log the password or PDF; only the stage/code for diagnosis.
    logger.warn('parse-statement invoke failed', { code });
    throw new StatementParseError(message, code);
  }

  if (!data?.ok || !data.extraction) {
    // Handled errors that came back as HTTP 200 with { ok:false, code, message }.
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.detail === 'string'
          ? data.detail
          : GENERIC_PARSE_MESSAGE;
    logger.warn('parse-statement returned error', { code: data?.code ?? null });
    throw new StatementParseError(message, data?.code ?? null);
  }

  return {
    extraction: data.extraction as StatementExtraction,
    extractionMethod: data.extractionMethod === 'pdf_document_fallback'
      ? 'pdf_document_fallback'
      : 'pdf_text',
  };
}

async function loadCardTxns(
  userId: string,
  cardId: string,
): Promise<VaultTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .neq('status', 'dismissed');
  if (error) throw error;
  return ((data as TransactionRow[]) ?? []).map(mapTransactionRow);
}

async function priorPeriodSpend(
  userId: string,
  cardId: string,
  periodStart: string,
): Promise<number | null> {
  // Previous import for this card, if any.
  const { data } = await supabase
    .from('statement_imports')
    .select('total_spend, period_end')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .lt('period_end', periodStart)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.total_spend != null) return Number(data.total_spend);

  // Fallback: sum confirmed debits in the window of equal length before periodStart.
  const start = new Date(periodStart + 'T00:00:00Z');
  // Rough prior 30 days
  const priorEnd = new Date(start);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - 29);
  const ps = priorStart.toISOString().slice(0, 10);
  const pe = priorEnd.toISOString().slice(0, 10);

  const { data: txns } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .eq('status', 'confirmed')
    .in('transaction_type', ['debit', 'annual_fee_debit'])
    .gte('transaction_date', ps)
    .lte('transaction_date', pe);
  if (!txns?.length) return null;
  return txns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

export function useLatestStatement(cardId: string | undefined) {
  return useQuery({
    queryKey: statementKeys.latest(cardId ?? ''),
    enabled: Boolean(cardId),
    queryFn: async (): Promise<StatementImportRow | null> => {
      const { data, error } = await supabase
        .from('statement_imports')
        .select('*')
        .eq('card_id', cardId!)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? mapImport(data as Record<string, unknown>) : null;
    },
    staleTime: 30_000,
  });
}

export function useUploadStatement(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      cardNickname: string;
      bankName: string;
      lastFour: string;
      benefitDescriptions: string[];
      /** PDF's own password (masked entry). Used once, never stored/logged. */
      pdfPassword?: string;
    }): Promise<StatementProcessResult> => {
      if (!userId) throw new Error('Sign in required.');

      const picked = await pickStatementPdf();
      if (!picked) throw new Error('cancelled');

      // Read into memory, send to edge, then drop references — never upload to Storage.
      let pdfBase64 = await readPdfBase64(picked.uri);
      try {
        await FileSystem.deleteAsync(picked.uri, { idempotent: true });
      } catch {
        /* cache cleanup best-effort */
      }

      let extraction: StatementExtraction;
      let extractionMethod: 'pdf_text' | 'pdf_document_fallback';
      try {
        const result = await invokeParseStatement({
          pdfBase64,
          cardId: args.cardId,
          cardNickname: args.cardNickname,
          bankName: args.bankName,
          lastFour: args.lastFour,
          password: args.pdfPassword,
        });
        extraction = result.extraction;
        extractionMethod = result.extractionMethod;
      } finally {
        // Drop base64 (and any password reference) from scope ASAP — never log.
        pdfBase64 = '';
      }

      const existing = await loadCardTxns(userId, args.cardId);
      const actions = planStatementMerge({
        lines: extraction.line_items,
        existing,
        cardId: args.cardId,
      });

      let newTxnCount = 0;
      let matchedTxnCount = 0;

      for (const action of actions) {
        if (action.kind === 'insert') {
          const { error } = await supabase.from('transactions').insert({
            user_id: userId,
            card_id: args.cardId,
            amount: action.line.amount,
            merchant_raw: action.line.merchant,
            merchant_normalized: action.line.merchant.trim().slice(0, 80),
            transaction_date: action.line.date,
            source: 'statement_pdf',
            source_confidence: 'high',
            status: 'confirmed',
            transaction_type: 'debit',
            link_status: 'linked',
            category: action.line.category,
            card_hint: {
              last_four: args.lastFour,
              bank_name_guess: args.bankName,
            },
            auto_finalize_at: null,
            raw_text: null,
          });
          if (error) {
            logger.warn('Statement line insert failed', { message: error.message });
            throw error;
          }
          newTxnCount += 1;
        } else if (action.kind === 'backfill_category') {
          const { error } = await supabase
            .from('transactions')
            .update({ category: action.line.category })
            .eq('id', action.existingId)
            .is('category', null);
          if (error) {
            logger.warn('Category backfill failed', { message: error.message });
          }
          matchedTxnCount += 1;
        } else {
          matchedTxnCount += 1;
        }
      }

      const breakdown = buildCategoryBreakdown(extraction.line_items);
      const notable = pickNotableTransactions(extraction.line_items, 5);
      const statedPoints = extraction.reward_points_earned;
      const estimatedPoints = estimateRewardPoints({
        lines: extraction.line_items,
        benefitDescriptions: args.benefitDescriptions,
      });
      const rewardPoints =
        statedPoints != null && statedPoints > 0 ? statedPoints : estimatedPoints;
      const rewardSource =
        statedPoints != null && statedPoints > 0 ? 'statement' : 'estimated';

      const prior = await priorPeriodSpend(
        userId,
        args.cardId,
        extraction.statement_period_start,
      );

      const { data: saved, error: saveErr } = await supabase
        .from('statement_imports')
        .insert({
          user_id: userId,
          card_id: args.cardId,
          period_start: extraction.statement_period_start,
          period_end: extraction.statement_period_end,
          total_spend: extraction.total_spend ?? 0,
          minimum_due: extraction.minimum_due,
          total_due: extraction.total_due,
          reward_points_earned: rewardPoints,
          reward_points_source: rewardSource,
          category_breakdown: breakdown,
          notable_transactions: notable,
          line_items: extraction.line_items,
          payment_due_date: extraction.payment_due_date,
          line_item_count: extraction.line_items.length,
          new_txn_count: newTxnCount,
          matched_txn_count: matchedTxnCount,
          prior_period_spend: prior,
          extraction_method: extractionMethod,
        })
        .select('*')
        .single();
      if (saveErr) throw saveErr;

      const mapped = mapImport(saved as Record<string, unknown>);
      let spendChangePct: number | null = null;
      if (prior != null && prior > 0) {
        spendChangePct = ((mapped.totalSpend - prior) / prior) * 100;
      }

      logger.info('Statement processed', {
        cardId: args.cardId,
        lines: extraction.line_items.length,
        newTxnCount,
        matchedTxnCount,
        extractionMethod,
      });

      return { import: mapped, spendChangePct };
    },
    onSuccess: (result) => {
      if (!userId) return;
      qc.invalidateQueries({ queryKey: trackKeys.txns(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.snapshot(userId) });
      qc.invalidateQueries({ queryKey: trackKeys.attention(userId) });
      qc.invalidateQueries({ queryKey: ['dashboard', userId] });
      qc.invalidateQueries({
        queryKey: statementKeys.latest(result.import.cardId),
      });
      qc.invalidateQueries({
        queryKey: statementKeys.list(result.import.cardId),
      });
    },
  });
}

export { statementKeys };
