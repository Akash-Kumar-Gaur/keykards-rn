/**
 * search-card-live — on-demand catalog lookup via Claude + web_search.
 *
 * Auth: caller's JWT. Service role writes catalog + live_searches audit rows.
 *
 * Flow:
 *  1. Rate-limit (default 5/user/day) + 24h dedupe cache
 *  2. Short-circuit if card_catalog / recent known_cards already has a hit
 *  3. Claude web_search extracts structured benefits
 *  4. Annualize value_estimate + period_raw; flag >10× fee as needs_review
 *  5. Preview JSON to client; on publish=true (or auto on success) upsert catalog
 *
 * Deploy: supabase functions deploy search-card-live
 * Secrets: ANTHROPIC_API_KEY (required), optional OPENAI_API_KEY fallback unused here
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const DAILY_LIMIT = Number(Deno.env.get('LIVE_SEARCH_DAILY_LIMIT') ?? 5);
const CACHE_HOURS = Number(Deno.env.get('LIVE_SEARCH_CACHE_HOURS') ?? 24);
const FEE_MULT = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(bank|credit|debit|card|the|ltd|limited)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type BenefitIn = {
  title: string;
  category: string;
  description: string;
  value_estimate: number | null;
  period_raw?: string | null;
};

function extractMoneyAmounts(text: string): number[] {
  const amounts: number[] = [];
  const re =
    /₹\s*([\d,]+(?:\.\d+)?)|Rs\.?\s*([\d,]+(?:\.\d+)?)|INR\s*([\d,]+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').replace(/,/g, '');
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) amounts.push(n);
  }
  return amounts;
}

function usesPerMonth(text: string): number {
  if (
    /(?:two|2)\s+times?\s+per\s+month|twice\s+(?:a|per)\s+month|valid\s+two\s+times\s+per\s+month/i.test(
      text,
    )
  ) {
    return 2;
  }
  const nTimes = text.match(/(\d+)\s+times?\s+per\s+month/i);
  if (nTimes) return Number(nTimes[1]);
  return 1;
}

function annualizeBenefit(b: BenefitIn): BenefitIn {
  if (b.value_estimate == null || !Number.isFinite(b.value_estimate)) return b;
  const text = `${b.title} ${b.description}`;
  const value = b.value_estimate;
  const amounts = extractMoneyAmounts(text);
  const monthly =
    /(per|each|a|every)\s+month|\/\s*mo(?:nth)?|monthly|each month|per calendar month/i.test(
      text,
    );
  const quarterly =
    /(per|each|a|every)\s+quarter|\/\s*quarter|quarterly|per statement quarter/i.test(
      text,
    );
  const oneTime =
    /first\s+\d+\s+days|welcome|one[\s-]?time|activation|joining/i.test(text);

  if (oneTime) {
    return { ...b, period_raw: b.period_raw ?? `₹${value} one-time` };
  }
  if (monthly) {
    const uses = usesPerMonth(text);
    for (const amt of amounts) {
      const monthlyTotal = amt * uses;
      if (Math.abs(value - monthlyTotal) < 1 || Math.abs(value - amt) < 1) {
        const annual = Math.round(monthlyTotal * 12);
        if (value < annual * 0.5) {
          return {
            ...b,
            value_estimate: annual,
            period_raw:
              b.period_raw ??
              (uses > 1 ? `₹${amt}×${uses}/month` : `₹${monthlyTotal}/month`),
          };
        }
      }
    }
    if (amounts.some((a) => Math.abs(a - value) < 1)) {
      return {
        ...b,
        value_estimate: Math.round(value * 12),
        period_raw: b.period_raw ?? `₹${value}/month`,
      };
    }
  }
  if (quarterly) {
    for (const amt of amounts) {
      if (Math.abs(value - amt) < 1) {
        return {
          ...b,
          value_estimate: Math.round(value * 4),
          period_raw: b.period_raw ?? `₹${value}/quarter`,
        };
      }
    }
  }
  return b;
}

function normalizeBenefits(benefits: BenefitIn[], annualFee: number | null) {
  const normalized = benefits.map(annualizeBenefit);
  const flags: string[] = [];
  let implausible = false;
  if (annualFee != null && annualFee > 0) {
    for (const b of normalized) {
      if (b.value_estimate != null && b.value_estimate > annualFee * FEE_MULT) {
        implausible = true;
        flags.push(
          `"${b.title}" ₹${b.value_estimate} >${FEE_MULT}× fee ₹${annualFee}`,
        );
      }
    }
  }
  return { benefits: normalized, implausible, flags };
}

const ALLOWED_CATS = new Set([
  'lounge',
  'dining',
  'travel',
  'shopping',
  'fuel',
  'entertainment',
  'other',
]);

function mapCategory(c: string): string {
  const x = c.toLowerCase().trim();
  if (x === 'milestone') return 'shopping';
  return ALLOWED_CATS.has(x) ? x : 'other';
}

const SYSTEM = `You research Indian credit/debit cards using web_search when needed.
Return ONLY valid JSON (no markdown) matching:
{
  "card_name": string,
  "bank_name": string,
  "annual_fee": number | null,
  "network": "Visa" | "Mastercard" | "RuPay" | "Amex" | "Diners" | null,
  "benefits": [
    {
      "title": string,
      "category": "lounge" | "dining" | "travel" | "shopping" | "fuel" | "entertainment" | "other",
      "description": string,
      "value_estimate": number | null,
      "period_raw": string | null
    }
  ],
  "confidence": "high" | "medium" | "low",
  "found": boolean
}

Rules:
- Search for official bank pages / T&Cs for "[bank] [card] credit card benefits annual fee India".
- found=false and confidence=low if you cannot identify the product.
- value_estimate MUST be an ANNUAL INR figure as a plain JSON number (e.g. 2880), never an expression.
  Monthly caps ×12, quarterly ×4, per-use with monthly limits: (amount × uses_per_month × 12). One-time welcome stays one-time.
- period_raw keeps the original figure (e.g. "₹240/month", "₹120×2/month").
- Never invent benefits. Prefer official issuer sources.
- Keep descriptions concise with spend gates / caps.`;

function sanitizeModelJson(text: string): string {
  // Models sometimes emit arithmetic instead of numbers, e.g. (1500*0.20) or 120*12.
  return text.replace(
    /("value_estimate"\s*:\s*)(\([^)"\],]+\)?|[\d.]+\s*[*/+\-]\s*[\d.]+(?:\s*[*/+\-]\s*[\d.]+)*)/g,
    (_m, prefix: string, expr: string) => {
      try {
        let cleaned = expr.trim();
        if (cleaned.startsWith('(') && !cleaned.endsWith(')')) cleaned += ')';
        cleaned = cleaned.replace(/[^\d.*/+\-()]/g, '');
        // eslint-disable-next-line no-new-func
        const n = Function(`"use strict"; return (${cleaned});`)();
        if (typeof n === 'number' && Number.isFinite(n)) {
          return `${prefix}${Math.round(n)}`;
        }
      } catch {
        /* fall through */
      }
      return `${prefix}null`;
    },
  );
}

function parseJsonObject(
  text: string,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1]!.trim();
  const brace = cleaned.match(/\{[\s\S]*\}/);
  if (!brace) return { ok: false, error: 'No JSON in model response' };
  const candidate = sanitizeModelJson(brace[0]);
  try {
    return { ok: true, data: JSON.parse(candidate) as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
    };
  }
}

async function callClaudeWebSearch(
  bank: string,
  card: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not configured' };

  const model =
    Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';

  const user = `Find benefits for this Indian card:
- bank_name: ${bank}
- card_name: ${card}

Use web_search for current official terms. Return the JSON object only.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
          user_location: {
            type: 'approximate',
            city: 'Mumbai',
            region: 'Maharashtra',
            country: 'IN',
            timezone: 'Asia/Kolkata',
          },
        },
      ],
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `Anthropic ${res.status}: ${errText.slice(0, 400)}` };
  }

  const payload = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (payload.content ?? [])
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
    .join('\n')
    .trim();

  if (!text) return { ok: false, error: 'Empty Anthropic response' };
  return parseJsonObject(text);
}

/** OpenAI Responses API + web_search — used when Anthropic is not configured. */
async function callOpenAiWebSearch(
  bank: string,
  card: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY not configured' };

  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o';
  const user = `Find benefits for this Indian card:
- bank_name: ${bank}
- card_name: ${card}

Use web_search for current official terms. ${SYSTEM}
Return the JSON object only.`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      tools: [{ type: 'web_search' }],
      // Note: web_search cannot be combined with JSON mode — parse free text.
      input: `${user}

IMPORTANT: Respond with a single valid JSON object only. value_estimate fields must be plain numbers, never arithmetic expressions.`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `OpenAI ${res.status}: ${errText.slice(0, 400)}` };
  }

  const payload = (await res.json()) as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  let text = (payload.output_text ?? '').trim();
  if (!text && Array.isArray(payload.output)) {
    text = payload.output
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === 'output_text' || c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
  }

  if (!text) return { ok: false, error: 'Empty OpenAI response' };
  return parseJsonObject(text);
}

async function callLiveLlmSearch(
  bank: string,
  card: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  if (Deno.env.get('ANTHROPIC_API_KEY')) {
    const claude = await callClaudeWebSearch(bank, card);
    if (claude.ok) return claude;
    // Fall through to OpenAI if Anthropic fails and OpenAI is available
    if (!Deno.env.get('OPENAI_API_KEY')) return claude;
  }
  return callOpenAiWebSearch(bank, card);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Server misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, error: 'Unauthorized' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const bankName = String(body.bank_name ?? '').trim();
  const cardName = String(body.card_name ?? '').trim();
  const publish = body.publish !== false; // default: write catalog on success
  if (!bankName || !cardName) {
    return json({ ok: false, error: 'bank_name and card_name are required' }, 400);
  }

  const bankNorm = normalizeKey(bankName);
  const cardNorm = normalizeKey(cardName);
  if (!bankNorm || !cardNorm) {
    return json({ ok: false, error: 'Invalid bank/card name' }, 400);
  }

  // 1) Catalog hit?
  {
    const { data: existing } = await admin
      .from('card_catalog')
      .select(
        'id, bank_name, card_name, network, default_annual_fee, default_benefits, default_color_theme, card_color_theme, source',
      )
      .ilike('bank_name', `%${bankName.split(/\s+/)[0]}%`)
      .ilike('card_name', `%${cardName.slice(0, 24)}%`)
      .limit(20);

    const hit = (existing ?? []).find((r) => {
      const bn = normalizeKey(r.bank_name);
      const cn = normalizeKey(r.card_name);
      return (
        (bn.includes(bankNorm) || bankNorm.includes(bn)) &&
        (cn.includes(cardNorm) || cardNorm.includes(cn))
      );
    });
    // Never surface needs_review rows to end users via catalog short-circuit
    if (hit && hit.source !== 'needs_review') {
      return json({
        ok: true,
        source: 'catalog',
        catalog_id: hit.id,
        entry: {
          id: hit.id,
          bankName: hit.bank_name,
          cardName: hit.card_name,
          network: hit.network,
          defaultAnnualFee: hit.default_annual_fee,
          defaultBenefits: hit.default_benefits,
          defaultColorTheme: hit.default_color_theme ?? hit.card_color_theme,
          source: hit.source,
        },
        message: 'Already in catalog',
      });
    }
  }

  // 2) 24h cache of prior live search
  {
    const since = new Date(Date.now() - CACHE_HOURS * 3600_000).toISOString();
    const { data: cached } = await admin
      .from('card_live_searches')
      .select('id, status, confidence, result_json, catalog_id, created_at')
      .eq('bank_name_norm', bankNorm)
      .eq('card_name_norm', cardNorm)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result_json && cached.status === 'success') {
      return json({
        ok: true,
        source: 'cache',
        catalog_id: cached.catalog_id,
        ...(cached.result_json as object),
        message: `Cached result from the last ${CACHE_HOURS}h`,
      });
    }
    if (cached && (cached.status === 'not_found' || cached.status === 'failed')) {
      return json({
        ok: false,
        source: 'cache',
        error:
          'A recent search for this card found nothing usable. Enter details manually, or try again tomorrow.',
        fallback_manual: true,
      });
    }
  }

  // Pending known_cards — don't spam live search
  {
    const { data: pending } = await admin
      .from('known_cards')
      .select('id, extraction_status')
      .eq('bank_name_norm', bankNorm)
      .eq('card_name_norm', cardNorm)
      .eq('extraction_status', 'pending')
      .maybeSingle();
    if (pending) {
      return json({
        ok: false,
        source: 'known_cards',
        error:
          'This card is already queued for catalog extraction. Enter details manually for now — benefits will appear after the next crawl.',
        fallback_manual: true,
      });
    }
  }

  // 3) Daily rate limit
  {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from('card_live_searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayStart.toISOString())
      .neq('status', 'cached');

    if ((count ?? 0) >= DAILY_LIMIT) {
      await admin.from('card_live_searches').insert({
        user_id: user.id,
        bank_name: bankName,
        card_name: cardName,
        bank_name_norm: bankNorm,
        card_name_norm: cardNorm,
        status: 'rate_limited',
      });
      return json(
        {
          ok: false,
          error: `Live search limit reached (${DAILY_LIMIT}/day). Enter details manually or try tomorrow.`,
          fallback_manual: true,
        },
        429,
      );
    }
  }

  // 4) Live LLM + web_search (Claude preferred, OpenAI fallback)
  const llm = await callLiveLlmSearch(bankName, cardName);
  if (!llm.ok) {
    await admin.from('card_live_searches').insert({
      user_id: user.id,
      bank_name: bankName,
      card_name: cardName,
      bank_name_norm: bankNorm,
      card_name_norm: cardNorm,
      status: 'failed',
      error_message: llm.error,
    });
    return json({
      ok: false,
      error: 'Live search failed. Enter details manually.',
      fallback_manual: true,
      detail: llm.error,
    });
  }

  const raw = llm.data;
  const found = raw.found !== false;
  const confidence = raw.confidence;
  if (
    !found ||
    (confidence !== 'high' && confidence !== 'medium') ||
    typeof raw.card_name !== 'string' ||
    !Array.isArray(raw.benefits) ||
    (raw.benefits as unknown[]).length === 0
  ) {
    await admin.from('card_live_searches').insert({
      user_id: user.id,
      bank_name: bankName,
      card_name: cardName,
      bank_name_norm: bankNorm,
      card_name_norm: cardNorm,
      status: 'not_found',
      confidence: typeof confidence === 'string' ? confidence : 'low',
      result_json: raw,
    });
    return json({
      ok: false,
      error: 'Couldn’t find reliable benefits for this card. Enter details manually.',
      fallback_manual: true,
      confidence: confidence ?? 'low',
    });
  }

  const annualFee =
    raw.annual_fee === null || raw.annual_fee === undefined
      ? null
      : Number(raw.annual_fee);

  const benefitsIn: BenefitIn[] = (raw.benefits as Record<string, unknown>[])
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      title: String(b.title ?? '').trim(),
      category: mapCategory(String(b.category ?? 'other')),
      description: String(b.description ?? '').trim(),
      value_estimate:
        b.value_estimate === null || b.value_estimate === undefined
          ? null
          : Number(b.value_estimate),
      period_raw:
        b.period_raw == null ? null : String(b.period_raw).trim() || null,
    }))
    .filter((b) => b.title.length > 0);

  const { benefits, implausible, flags } = normalizeBenefits(
    benefitsIn,
    Number.isFinite(annualFee as number) ? (annualFee as number) : null,
  );

  const network =
    typeof raw.network === 'string' &&
    ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners'].includes(raw.network)
      ? raw.network
      : 'Visa';

  const catalogSource = implausible ? 'needs_review' : 'auto';
  let catalogId: string | null = null;

  if (publish) {
    const row = {
      bank_name: String(raw.bank_name ?? bankName).trim(),
      card_name: String(raw.card_name ?? cardName).trim(),
      network,
      default_benefits: benefits,
      default_annual_fee: Number.isFinite(annualFee as number)
        ? annualFee
        : null,
      card_color_theme: 'generic-slate',
      default_color_theme: 'generic-slate',
      source: catalogSource,
      last_verified_at: new Date().toISOString(),
      refresh_priority: 'standard',
    };

    const { data: inserted, error: insErr } = await admin
      .from('card_catalog')
      .insert(row)
      .select('id')
      .single();

    if (insErr) {
      // Unique conflict — try match update only if not manual
      const { data: existing } = await admin
        .from('card_catalog')
        .select('id, source')
        .eq('bank_name', row.bank_name)
        .eq('card_name', row.card_name)
        .maybeSingle();
      if (existing && existing.source !== 'manual') {
        await admin.from('card_catalog').update(row).eq('id', existing.id);
        catalogId = existing.id;
      } else if (existing) {
        catalogId = existing.id;
      } else {
        await admin.from('card_live_searches').insert({
          user_id: user.id,
          bank_name: bankName,
          card_name: cardName,
          bank_name_norm: bankNorm,
          card_name_norm: cardNorm,
          status: 'failed',
          error_message: insErr.message,
        });
        return json({
          ok: false,
          error: 'Found benefits but could not save to catalog. Enter manually.',
          fallback_manual: true,
          preview: {
            bankName: row.bank_name,
            cardName: row.card_name,
            network,
            defaultAnnualFee: row.default_annual_fee,
            defaultBenefits: benefits,
          },
        });
      }
    } else {
      catalogId = inserted.id as string;
    }
  }

  const preview = {
    id: catalogId ?? `live-${crypto.randomUUID()}`,
    bankName: String(raw.bank_name ?? bankName).trim(),
    cardName: String(raw.card_name ?? cardName).trim(),
    network,
    defaultAnnualFee: Number.isFinite(annualFee as number) ? annualFee : null,
    defaultBenefits: benefits,
    defaultColorTheme: 'generic-slate',
    source: catalogSource,
  };

  const resultPayload = {
    ok: true,
    source: 'live',
    catalog_id: catalogId,
    confidence,
    needs_review: implausible,
    sanity_flags: flags,
    entry: preview,
    message: implausible
      ? 'Found — some benefit values look high vs the annual fee; review before saving.'
      : 'Here’s what we found — does this look right?',
  };

  await admin.from('card_live_searches').insert({
    user_id: user.id,
    bank_name: bankName,
    card_name: cardName,
    bank_name_norm: bankNorm,
    card_name_norm: cardNorm,
    status: 'success',
    confidence: String(confidence),
    result_json: resultPayload,
    catalog_id: catalogId,
  });

  return json(resultPayload);
});
