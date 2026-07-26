/**
 * parse-statement — extract text from a credit-card statement PDF, structure
 * with an LLM, return validated JSON. The PDF bytes are never written to
 * Storage; they live only in this request's memory.
 *
 * Deploy: supabase functions deploy parse-statement
 * Secrets (prefer OpenAI — already used by catalog-scraper):
 *   OPENAI_API_KEY (required unless ANTHROPIC_API_KEY is set)
 *   OPENAI_MODEL (optional, default gpt-4o-mini) — text extraction path
 *   OPENAI_PDF_MODEL (optional, default gpt-4o) — scanned PDF fallback
 *   ANTHROPIC_API_KEY / ANTHROPIC_MODEL — optional fallback if OpenAI unset
 *
 * Auth: caller's Supabase JWT (Authorization: Bearer <access_token>).
 * Gateway JWT verification should stay enabled; the function also checks getUser().
 *
 * Pipeline (each stage returns a SPECIFIC, structured error so the app can
 * show a precise themed message instead of a bare non-2xx):
 *   received → decoded → opened (decrypt if password) → text extracted
 *   → LLM parsed → validated
 *
 * Password-protected PDFs: if `password` is supplied it is used to decrypt the
 * PDF before extraction. The password is used only in this request and never
 * stored or logged. Wrong password / missing-but-required password produce
 * their own targeted error codes.
 *
 * PDF text extraction: `unpdf` (pdf.js-based). If extracted text is near-empty
 * (< MIN_TEXT_CHARS), falls back to the LLM's native PDF / file input
 * (handles scanned image PDFs without a separate OCR stack).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { extractText, getDocumentProxy } from 'npm:unpdf';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_TEXT_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const OPENAI_PDF_MODEL = Deno.env.get('OPENAI_PDF_MODEL') ?? 'gpt-4o';
const ANTHROPIC_MODEL =
  Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';
const MIN_TEXT_CHARS = 80;
const MAX_TEXT_CHARS = 120_000;

/**
 * Stage-specific error codes. The `message` is safe to show the user verbatim.
 * HTTP stays 200 for handled cases so supabase-js never collapses the body into
 * an opaque "non-2xx" FunctionsHttpError — the app branches on `ok`/`code`.
 */
const ERRORS = {
  unauthorized: { stage: 'auth', message: 'Please sign in and try again.' },
  bad_request: {
    stage: 'received',
    message: 'No statement file was received. Please pick a PDF and try again.',
  },
  card_not_found: {
    stage: 'auth',
    message: 'We couldn’t find this card. Reopen the card and try again.',
  },
  pdf_decode_failed: {
    stage: 'decoded',
    message: 'This file didn’t look like a valid PDF. Please choose a PDF statement.',
  },
  password_required: {
    stage: 'opened',
    message:
      'This PDF looks password-protected. Tick “This PDF is password-protected” and enter the PDF’s password.',
  },
  incorrect_password: {
    stage: 'opened',
    message: 'Incorrect password — please check and try again.',
  },
  pdf_unreadable: {
    stage: 'extracted',
    message: 'Couldn’t read this statement’s format. Try a different statement PDF.',
  },
  scanned_protected_unsupported: {
    stage: 'extracted',
    message:
      'This looks like a scanned, password-protected statement we can’t read yet. Try an unlocked or text-based PDF.',
  },
  llm_failed: {
    stage: 'llm',
    message: 'Something went wrong reading the statement. Please try again.',
  },
  /** @deprecated alias — app may still log this code from older deploys */
  claude_failed: {
    stage: 'llm',
    message: 'Something went wrong reading the statement. Please try again.',
  },
  empty_model_response: {
    stage: 'llm',
    message: 'Something went wrong reading the statement. Please try again.',
  },
  invalid_model_json: {
    stage: 'validated',
    message: 'Couldn’t read this statement’s format. Try a different statement PDF.',
  },
  internal: {
    stage: 'unknown',
    message: 'Something went wrong, please try again.',
  },
} as const;

type ErrorCode = keyof typeof ERRORS;

const SYSTEM = `You extract credit-card statement data from bank statement text.
Return ONLY valid JSON (no markdown fences) matching this exact shape:
{
  "statement_period_start": "YYYY-MM-DD",
  "statement_period_end": "YYYY-MM-DD",
  "total_spend": number | null,
  "minimum_due": number | null,
  "total_due": number | null,
  "payment_due_date": "YYYY-MM-DD" | null,
  "reward_points_earned": number | null,
  "line_items": [
    {
      "date": "YYYY-MM-DD",
      "merchant": string,
      "amount": number,
      "category": "lounge" | "dining" | "travel" | "shopping" | "fuel" | "entertainment" | "other"
    }
  ]
}

Rules:
- Extract purchase / debit line items only. Skip payments, credits, reversals, and fee waivers unless they are clearly billed charges.
- amount is always a positive INR number (no commas, no currency symbol).
- Prefer the statement's printed period dates when present.
- total_spend should match the statement's purchase total when stated; otherwise null (caller will sum line items).
- reward_points_earned only when the statement explicitly shows points earned this period; otherwise null.
- payment_due_date when the statement prints a payment due date; otherwise null.
- category: map from MCC / merchant type. Use "other" when unsure.
- Do NOT invent merchants or amounts. Skip unreadable rows.
- Never include the full card number or CVV in any field. Merchants only.`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Structured, user-safe failure. HTTP 200 by default so the body always reaches the app. */
function fail(code: ErrorCode, httpStatus = 200, detail?: string) {
  const { stage, message } = ERRORS[code];
  // Server-side diagnosis line (no PDF contents / no password ever logged).
  console.error(
    `parse-statement failed stage=${stage} code=${code}` +
      (detail ? ` detail=${detail.slice(0, 160)}` : ''),
  );
  return json({ ok: false, code, stage, message }, httpStatus);
}

/** True when a thrown error is pdf.js's PasswordException. code: 1 need, 2 incorrect. */
function passwordException(e: unknown): { need: boolean; incorrect: boolean } | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as { name?: string; code?: number; message?: string };
  const isPwd =
    err.name === 'PasswordException' ||
    /password/i.test(err.message ?? '');
  if (!isPwd) return null;
  // PasswordResponses: NEED_PASSWORD = 1, INCORRECT_PASSWORD = 2.
  if (err.code === 2) return { need: false, incorrect: true };
  if (err.code === 1) return { need: true, incorrect: false };
  // Fallback on message wording when code is absent.
  const incorrect = /incorrect|invalid/i.test(err.message ?? '');
  return { need: !incorrect, incorrect };
}

/** Mirror of src/lib/statementParse.ts — keep in sync. */
function parseStatementLlmJson(raw: string) {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1]!.trim();

  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    const brace = text.match(/\{[\s\S]*\}/);
    if (!brace) return { ok: false as const, error: 'No JSON object', raw };
    try {
      obj = JSON.parse(brace[0]);
    } catch (e) {
      return {
        ok: false as const,
        error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
        raw,
      };
    }
  }
  if (!obj || typeof obj !== 'object') {
    return { ok: false as const, error: 'Not an object', raw };
  }
  const o = obj as Record<string, unknown>;
  const iso = (v: unknown) => {
    if (typeof v !== 'string') return null;
    const t = v.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
  };
  const num = (v: unknown) => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const cats = new Set([
    'lounge',
    'dining',
    'travel',
    'shopping',
    'fuel',
    'entertainment',
    'other',
  ]);
  const periodStart = iso(o.statement_period_start);
  const periodEnd = iso(o.statement_period_end);
  if (!periodStart || !periodEnd) {
    return { ok: false as const, error: 'Missing period dates', raw };
  }
  if (!Array.isArray(o.line_items)) {
    return { ok: false as const, error: 'Missing line_items', raw };
  }
  const line_items: Array<{
    date: string;
    merchant: string;
    amount: number;
    category: string;
  }> = [];
  for (const row of o.line_items) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const date = iso(r.date);
    const merchant = String(r.merchant ?? '').trim();
    const amount = num(r.amount);
    if (!date || !merchant || amount == null || amount <= 0) continue;
    const cat = String(r.category ?? 'other').toLowerCase();
    line_items.push({
      date,
      merchant: merchant.slice(0, 120),
      amount,
      category: cats.has(cat) ? cat : 'other',
    });
  }
  if (line_items.length === 0) {
    return { ok: false as const, error: 'No valid line_items', raw };
  }
  const summed = line_items.reduce((s, i) => s + i.amount, 0);
  const totalSpend = num(o.total_spend);
  return {
    ok: true as const,
    data: {
      statement_period_start: periodStart,
      statement_period_end: periodEnd,
      total_spend:
        totalSpend != null && totalSpend > 0
          ? totalSpend
          : Math.round(summed * 100) / 100,
      minimum_due: num(o.minimum_due),
      total_due: num(o.total_due),
      payment_due_date: iso(o.payment_due_date),
      reward_points_earned: num(o.reward_points_earned),
      line_items,
    },
  };
}

function userPromptText(statementText: string, cardHint: string) {
  const truncated =
    statementText.length > MAX_TEXT_CHARS
      ? statementText.slice(0, MAX_TEXT_CHARS)
      : statementText;
  return `Card context (for category hints only — do not invent spend):
${cardHint}

Statement text:
${truncated}`;
}

function userPromptPdf(cardHint: string) {
  return `Card context (for category hints only — do not invent spend):
${cardHint}

Extract structured statement JSON from this PDF.`;
}

function llmProvider(): 'openai' | 'anthropic' {
  if (Deno.env.get('OPENAI_API_KEY')) return 'openai';
  if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic';
  throw new Error('No LLM key configured — set OPENAI_API_KEY (preferred) or ANTHROPIC_API_KEY');
}

async function callOpenAIText(statementText: string, cardHint: string) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      temperature: 0,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPromptText(statementText, cardHint) },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const body = await res.json();
  return String(body.choices?.[0]?.message?.content ?? '').trim();
}

async function callOpenAIPdf(base64: string, cardHint: string) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  // Chat Completions file input (PDF) — requires a vision-capable model (gpt-4o).
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_PDF_MODEL,
      temperature: 0,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'statement.pdf',
                file_data: `data:application/pdf;base64,${base64}`,
              },
            },
            { type: 'text', text: userPromptPdf(cardHint) },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI PDF error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const body = await res.json();
  return String(body.choices?.[0]?.message?.content ?? '').trim();
}

async function callAnthropicText(statementText: string, cardHint: string) {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: userPromptText(statementText, cardHint),
        },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const body = await res.json();
  return (body.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
}

async function callAnthropicPdf(base64: string, cardHint: string) {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            { type: 'text', text: userPromptPdf(cardHint) },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude PDF error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const body = await res.json();
  return (body.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
}

async function callLlmText(statementText: string, cardHint: string) {
  return llmProvider() === 'openai'
    ? callOpenAIText(statementText, cardHint)
    : callAnthropicText(statementText, cardHint);
}

async function callLlmPdf(base64: string, cardHint: string) {
  return llmProvider() === 'openai'
    ? callOpenAIPdf(base64, cardHint)
    : callAnthropicPdf(base64, cardHint);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, code: 'bad_request', message: 'Method not allowed' }, 405);
  }

  try {
    // ---- Stage: auth ------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail('unauthorized', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return fail('unauthorized', 401);

    // ---- Stage: received --------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
    const cardId = typeof body.cardId === 'string' ? body.cardId : '';
    const cardNickname =
      typeof body.cardNickname === 'string' ? body.cardNickname : '';
    const bankName = typeof body.bankName === 'string' ? body.bankName : '';
    const lastFour = typeof body.lastFour === 'string' ? body.lastFour : '';
    // SENSITIVE: PDF password — used only here, never persisted or logged.
    const password =
      typeof body.password === 'string' && body.password.length > 0
        ? body.password
        : undefined;

    if (!pdfBase64 || !cardId) {
      return fail('bad_request');
    }

    // Verify the card belongs to the caller (RLS also enforces this).
    const { data: card, error: cardErr } = await supabase
      .from('cards')
      .select('id, nickname, bank_name, last_four')
      .eq('id', cardId)
      .maybeSingle();
    if (cardErr || !card) return fail('card_not_found', 404);

    const cardHint = [
      `nickname: ${cardNickname || card.nickname}`,
      `bank: ${bankName || card.bank_name}`,
      `last_four: ${lastFour || card.last_four}`,
    ].join('\n');

    // ---- Stage: decoded ---------------------------------------------------
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      if (bytes.length < 5) throw new Error('too small');
    } catch (e) {
      return fail('pdf_decode_failed', 400, e instanceof Error ? e.message : undefined);
    }

    // ---- Stage: opened (decrypt with password if needed) ------------------
    let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
    let wasEncrypted = false;
    try {
      // pdf.js resolves directly when a correct (or no) password is supplied,
      // and rejects with PasswordException when one is required/incorrect.
      pdf = await getDocumentProxy(
        bytes,
        password ? { password } : undefined,
      );
      wasEncrypted = Boolean(password);
    } catch (e) {
      const pwd = passwordException(e);
      if (pwd?.incorrect) return fail('incorrect_password', 400);
      if (pwd?.need) return fail('password_required', 400);
      // Not a password problem — corrupt / unsupported PDF.
      return fail('pdf_unreadable', 422, e instanceof Error ? e.message : undefined);
    }

    // ---- Stage: extracted -------------------------------------------------
    let statementText = '';
    try {
      const { text: extracted } = await extractText(pdf, { mergePages: true });
      statementText = (extracted ?? '').replace(/\u0000/g, ' ').trim();
    } catch (e) {
      return fail('pdf_unreadable', 422, e instanceof Error ? e.message : undefined);
    }

    // ---- Stage: llm -------------------------------------------------------
    let extractionMethod: 'pdf_text' | 'pdf_document_fallback' = 'pdf_text';
    let rawModel = '';
    try {
      if (statementText.length >= MIN_TEXT_CHARS) {
        rawModel = await callLlmText(statementText, cardHint);
      } else if (wasEncrypted) {
        // Scanned + encrypted: LLM can't read the still-encrypted bytes.
        return fail('scanned_protected_unsupported', 422);
      } else {
        // Scanned / image-only PDF — OpenAI/Claude reads the document directly.
        extractionMethod = 'pdf_document_fallback';
        rawModel = await callLlmPdf(pdfBase64, cardHint);
      }
    } catch (e) {
      return fail('llm_failed', 502, e instanceof Error ? e.message : undefined);
    }

    if (!rawModel) {
      return fail('empty_model_response', 502);
    }

    // ---- Stage: validated -------------------------------------------------
    const parsed = parseStatementLlmJson(rawModel);
    if (!parsed.ok) {
      // Never echo full raw (may contain name / PAN) — only a short detail.
      return fail('invalid_model_json', 422, parsed.error);
    }

    return json({
      ok: true,
      extractionMethod,
      textChars: statementText.length,
      extraction: parsed.data,
    });
  } catch (e) {
    // Do not include stack / request body — may hold statement contents.
    return fail('internal', 500, e instanceof Error ? e.message : undefined);
  }
});
