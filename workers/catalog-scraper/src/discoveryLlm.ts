/**
 * LLM extraction of card listings from aggregator/bank listing page text.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from './config.js';
import { serializeError } from './errors.js';
import { truncateForLlm } from './fetch.js';
import type { DiscoverySource } from './discoverySources.js';

export type DiscoveredCard = {
  bank_name: string;
  card_name: string;
  card_type: 'credit' | 'debit';
  detail_url: string;
};

const SYSTEM = `You extract credit and debit card product listings from Indian bank / aggregator listing pages.
Return ONLY valid JSON (no markdown fences):
{
  "cards": [
    {
      "bank_name": string,
      "card_name": string,
      "card_type": "credit" | "debit",
      "detail_url": string
    }
  ]
}

Rules:
- Include every distinct card product clearly listed with a name.
- Prefer detail/product page URLs from [link:…] markers in the text when present.
- detail_url must be an absolute http(s) URL when possible; if only a relative path appears, leave it as the path starting with / — the caller will resolve it.
- Skip ads, EMI calculators, login, apply-now CTAs without a product name, and generic category pages.
- Do not invent cards that are not on the page.
- If bank is unclear, use the bank_hint from the user message when provided.
- card_type defaults to the page default when the listing does not say debit/credit.
- Deduplicate near-identical names on the same page (keep one).
- Cap at 80 cards max for very long pages (prefer unique product pages).`;

function buildUserPrompt(source: DiscoverySource, pageText: string, pageUrl: string): string {
  const truncated = truncateForLlm(pageText, config.maxPromptChars);
  return `Listing source:
- id: ${source.id}
- name: ${source.name}
- kind: ${source.kind}
- default_card_type: ${source.defaultCardType === 'mixed' ? 'credit' : source.defaultCardType}
- bank_hint: ${source.bankHint ?? 'unknown'}
- page_url: ${pageUrl}

Page text (anchors appear as "Label [link:url]"):
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
    max_tokens: 8192,
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

function parseCardsJson(raw: string): DiscoveredCard[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(cleaned) as { cards?: unknown };
  if (!Array.isArray(parsed.cards)) return [];
  const out: DiscoveredCard[] = [];
  for (const c of parsed.cards) {
    if (!c || typeof c !== 'object') continue;
    const row = c as Record<string, unknown>;
    const bank = String(row.bank_name ?? '').trim();
    const name = String(row.card_name ?? '').trim();
    const url = String(row.detail_url ?? '').trim();
    if (!bank || !name || !url) continue;
    const typeRaw = String(row.card_type ?? 'credit').toLowerCase();
    out.push({
      bank_name: bank,
      card_name: name,
      card_type: typeRaw === 'debit' ? 'debit' : 'credit',
      detail_url: url,
    });
  }
  return out;
}

export function resolveDetailUrl(url: string, baseUrl: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed.startsWith('javascript:')) return null;
  try {
    const abs = new URL(trimmed, baseUrl);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
    return abs.toString();
  } catch {
    return null;
  }
}

export async function extractCardsFromListing(
  source: DiscoverySource,
  pageText: string,
  pageUrl: string,
): Promise<
  | { ok: true; cards: DiscoveredCard[] }
  | { ok: false; error: string; raw?: string }
> {
  if (!config.llmProvider) {
    return { ok: false, error: 'No LLM configured' };
  }
  const user = buildUserPrompt(source, pageText, pageUrl);
  console.log(`  [discovery-llm] provider=${config.llmProvider}`);
  try {
    const raw =
      config.llmProvider === 'openai'
        ? await callOpenAI(user)
        : await callAnthropic(user);
    const cards = parseCardsJson(raw)
      .map((c) => {
        const detail = resolveDetailUrl(c.detail_url, pageUrl);
        if (!detail) return null;
        const type =
          source.defaultCardType === 'debit'
            ? 'debit'
            : source.defaultCardType === 'credit'
              ? c.card_type
              : c.card_type;
        return {
          ...c,
          card_type: type as 'credit' | 'debit',
          detail_url: detail,
          bank_name:
            source.kind === 'bank' && source.bankHint
              ? source.bankHint
              : c.bank_name,
        };
      })
      .filter((c): c is DiscoveredCard => c != null);
    return { ok: true, cards };
  } catch (e) {
    return { ok: false, error: serializeError(e) };
  }
}
