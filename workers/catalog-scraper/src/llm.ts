/**
 * LLM structuring step — OpenAI or Anthropic, defensive JSON parse.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from './config.js';
import { serializeError } from './errors.js';
import type { CatalogSource } from './sources.js';
import type { LlmExtraction } from './types.js';
import { truncateForLlm } from './fetch.js';

const SYSTEM = `You extract credit/debit card benefit data from bank marketing page text.
Return ONLY valid JSON (no markdown fences) matching this exact shape:
{
  "card_name": string,
  "bank_name": string,
  "annual_fee": number | null,
  "network": "Visa" | "Mastercard" | "RuPay" | "Amex" | "Diners" | null,
  "benefits": [
    {
      "title": string,
      "category": "lounge" | "dining" | "travel" | "shopping" | "milestone" | "fuel" | "entertainment" | "other",
      "description": string,
      "value_estimate": number | null
    }
  ],
  "confidence": "high" | "medium" | "low"
}

Rules:
- Extract ONLY facts explicitly stated or clearly listed on the page. Do not invent benefits.
- value_estimate is an annual INR estimate when a clear rupee amount/cashback cap is stated; otherwise null. Never use spend thresholds as value_estimate.
- If the page is ambiguous, partial, mostly navigation, or you had to infer, set confidence to "low".
- Use "medium" when most fields are present but some details are unclear.
- Use "high" only when card name, bank, and several concrete benefits are clearly readable.
- Prefer the known card/bank names provided in the user message when the page is consistent with them.
- Keep descriptions concise (1–3 sentences) including spend gates / caps when stated.`;

function buildUserPrompt(source: CatalogSource, pageText: string): string {
  const truncated = truncateForLlm(pageText, config.maxPromptChars);
  return `Known card (from registry — use when consistent with page):
- id: ${source.id}
- card_name: ${source.name}
- bank_name: ${source.issuer}
- network: ${source.network}
- registry_annual_fee: ${source.annualFee ?? 'unknown'}

Page text:
${truncated}`;
}

async function callOpenAI(user: string): Promise<string> {
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const msg = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
  });
  return msg.choices[0]?.message?.content?.trim() ?? '';
}

async function callAnthropic(user: string): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const msg = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
    .trim();
}

export async function structureWithLlm(
  source: CatalogSource,
  pageText: string,
): Promise<{ ok: true; data: LlmExtraction } | { ok: false; error: string; raw?: string }> {
  if (!config.llmProvider) {
    return {
      ok: false,
      error: 'No LLM configured — set OPENAI_API_KEY or ANTHROPIC_API_KEY',
    };
  }

  const user = buildUserPrompt(source, pageText);
  console.log(`  [llm] provider=${config.llmProvider}`);

  try {
    const raw =
      config.llmProvider === 'openai'
        ? await callOpenAI(user)
        : await callAnthropic(user);

    if (!raw) {
      return { ok: false, error: 'Empty LLM response' };
    }

    const parsed = parseLlmJson(raw);
    if (!parsed.ok) return parsed;
    return { ok: true, data: parsed.data };
  } catch (e) {
    return {
      ok: false,
      error: serializeError(e),
    };
  }
}

function parseLlmJson(
  raw: string,
): { ok: true; data: LlmExtraction } | { ok: false; error: string; raw: string } {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1]!.trim();

  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    const brace = text.match(/\{[\s\S]*\}/);
    if (!brace) {
      return { ok: false, error: 'No JSON object in model response', raw };
    }
    try {
      obj = JSON.parse(brace[0]);
    } catch (e) {
      return {
        ok: false,
        error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
        raw,
      };
    }
  }

  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'Parsed value is not an object', raw };
  }

  const o = obj as Record<string, unknown>;
  const confidence = o.confidence;
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
    return { ok: false, error: 'Missing/invalid confidence', raw };
  }
  if (typeof o.card_name !== 'string' || !o.card_name.trim()) {
    return { ok: false, error: 'Missing card_name', raw };
  }
  if (typeof o.bank_name !== 'string' || !o.bank_name.trim()) {
    return { ok: false, error: 'Missing bank_name', raw };
  }
  if (!Array.isArray(o.benefits)) {
    return { ok: false, error: 'Missing benefits array', raw };
  }

  const annual =
    o.annual_fee === null || o.annual_fee === undefined
      ? null
      : Number(o.annual_fee);

  const benefits = o.benefits
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({
      title: String(b.title ?? '').trim(),
      category: String(b.category ?? 'other') as LlmExtraction['benefits'][0]['category'],
      description: String(b.description ?? '').trim(),
      value_estimate:
        b.value_estimate === null || b.value_estimate === undefined
          ? null
          : Number(b.value_estimate),
    }))
    .filter((b) => b.title.length > 0);

  return {
    ok: true,
    data: {
      card_name: o.card_name.trim(),
      bank_name: o.bank_name.trim(),
      annual_fee: Number.isFinite(annual as number) ? (annual as number) : null,
      benefits,
      confidence,
      network: typeof o.network === 'string' ? o.network : undefined,
      card_color_theme:
        typeof o.card_color_theme === 'string' ? o.card_color_theme : undefined,
    },
  };
}
