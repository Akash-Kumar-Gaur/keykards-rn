/**
 * Fetch layer — extends Benefit Radar fetch (static HTML + strip).
 * Optional Playwright for JS-rendered / thin pages.
 *
 * Order matters for flaky bank sites (HDFC):
 *  1. Try every URL with static fetch (primary + fallbacks)
 *  2. Only then try Playwright on preferPlaywright / still-thin pages
 * This avoids hanging on Playwright before a working fallback is attempted.
 */

import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import type { CatalogSource } from './sources.js';
import type { FetchResult } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../.cache');

/** Static fetch timeout — bank CDNs often stall; fail fast and try fallbacks. */
const STATIC_TIMEOUT_MS = 12_000;
const PLAYWRIGHT_TIMEOUT_MS = 25_000;

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Cache-Control': 'no-cache',
};

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&#8377;/g, '₹')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Like stripHtml but keeps anchor text + absolute/relative hrefs so discovery
 * LLM can recover detail_url from listing pages.
 */
export function stripHtmlKeepLinks(html: string, baseUrl: string): string {
  const withLinks = html.replace(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const text = stripHtml(inner).slice(0, 120);
      let abs = href.trim();
      try {
        abs = new URL(href, baseUrl).toString();
      } catch {
        /* keep raw */
      }
      if (!text) return ` [link:${abs}] `;
      return ` ${text} [link:${abs}] `;
    },
  );
  return stripHtml(withLinks);
}

function cachePath(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 32);
  return join(CACHE_DIR, `${hash}.txt`);
}

function writeCache(url: string, text: string): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath(url), text, 'utf8');
  } catch {
    /* ignore */
  }
}

async function fetchStaticRaw(url: string, isRetry = false): Promise<string> {
  console.log(`  [fetch${isRetry ? ' retry' : ''}] ${url}`);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(STATIC_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) {
      console.warn(`  [warn] HTTP ${res.status} for ${url}`);
      return '';
    }
    return await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isRetry) {
      console.warn(`  [warn] ${msg} — retrying once`);
      await sleep(1000);
      return fetchStaticRaw(url, true);
    }
    console.warn(`  [warn] fetch failed: ${msg}`);
    return '';
  }
}

async function fetchStatic(url: string, isRetry = false): Promise<string> {
  const html = await fetchStaticRaw(url, isRetry);
  if (!html) return '';
  const text = stripHtml(html);
  if (text.length > 200) writeCache(url, text);
  return text;
}

async function fetchPlaywrightRaw(url: string): Promise<string> {
  if (!config.usePlaywright) return '';
  console.log(`  [playwright] ${url}`);
  let browser: { close: () => Promise<void>; newPage: (o?: object) => Promise<{
    setDefaultTimeout: (n: number) => void;
    goto: (u: string, o: object) => Promise<unknown>;
    content: () => Promise<string>;
  }> } | null = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      timeout: 15_000,
    });
    const page = await browser.newPage({
      userAgent: HEADERS['User-Agent'],
    });
    page.setDefaultTimeout(PLAYWRIGHT_TIMEOUT_MS);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PLAYWRIGHT_TIMEOUT_MS,
    });
    await sleep(1500);
    return await page.content();
  } catch (e) {
    console.warn(
      `  [warn] playwright failed: ${e instanceof Error ? e.message : e}`,
    );
    return '';
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

async function fetchPlaywright(url: string): Promise<string> {
  const html = await fetchPlaywrightRaw(url);
  if (!html) return '';
  const text = stripHtml(html);
  if (text.length > 200) writeCache(url, text);
  return text;
}

function readCache(url: string): string {
  const p = cachePath(url);
  if (!existsSync(p)) return '';
  const ageHours = (Date.now() - statSync(p).mtimeMs) / 3_600_000;
  if (ageHours > 24) return '';
  console.log(`  [cache] ${url}`);
  return readFileSync(p, 'utf8');
}

export async function fetchSourcePage(source: CatalogSource): Promise<FetchResult> {
  const urls = [...source.urls, ...(source.fallbackUrls ?? [])];

  // Pass 1: static (and cache) across all URLs — never block on Playwright yet.
  let best: { text: string; url: string } | null = null;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    let text = readCache(url);
    if (!text) text = await fetchStatic(url);
    if (text.length > (best?.text.length ?? 0)) {
      best = { text, url };
    }
    if (text.length >= 800) {
      return {
        text,
        url,
        usedPlaywright: false,
        charCount: text.length,
      };
    }
    if (i < urls.length - 1) await sleep(400);
  }

  // Pass 2: Playwright only if still thin / flagged, and only on a few candidates.
  if (config.usePlaywright && (source.preferPlaywright || !best || best.text.length < 800)) {
    const candidates = source.preferPlaywright
      ? urls.slice(0, 2)
      : [best?.url ?? urls[0]!].filter(Boolean);
    for (const url of candidates) {
      const pw = await fetchPlaywright(url);
      if (pw.length > (best?.text.length ?? 0)) {
        best = { text: pw, url };
      }
      if (pw.length >= 800) {
        return {
          text: pw,
          url,
          usedPlaywright: true,
          charCount: pw.length,
        };
      }
    }
  }

  if (best && best.text.length > 500) {
    return {
      text: best.text,
      url: best.url,
      usedPlaywright: false,
      charCount: best.text.length,
    };
  }

  return { text: '', url: null, usedPlaywright: false, charCount: 0 };
}

/**
 * Fetch a listing/comparison page for discovery — preserves [link:url] markers.
 */
export async function fetchListingPage(opts: {
  urls: string[];
  preferPlaywright?: boolean;
}): Promise<FetchResult> {
  const urls = opts.urls;
  let best: { text: string; url: string; usedPlaywright: boolean } | null = null;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const html = await fetchStaticRaw(url);
    if (html) {
      const text = stripHtmlKeepLinks(html, url);
      if (text.length > (best?.text.length ?? 0)) {
        best = { text, url, usedPlaywright: false };
      }
      if (text.length >= 1500 && (text.match(/\[link:/g) ?? []).length >= 3) {
        return {
          text,
          url,
          usedPlaywright: false,
          charCount: text.length,
        };
      }
    }
    if (i < urls.length - 1) await sleep(400);
  }

  if (
    config.usePlaywright &&
    (opts.preferPlaywright || !best || best.text.length < 1500)
  ) {
    for (const url of urls.slice(0, 2)) {
      const html = await fetchPlaywrightRaw(url);
      if (!html) continue;
      const text = stripHtmlKeepLinks(html, url);
      if (text.length > (best?.text.length ?? 0)) {
        best = { text, url, usedPlaywright: true };
      }
      if (text.length >= 800) {
        return {
          text,
          url,
          usedPlaywright: true,
          charCount: text.length,
        };
      }
    }
  }

  if (best && best.text.length > 400) {
    return {
      text: best.text,
      url: best.url,
      usedPlaywright: best.usedPlaywright,
      charCount: best.text.length,
    };
  }

  return { text: '', url: null, usedPlaywright: false, charCount: 0 };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function truncateForLlm(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[TRUNCATED]`;
}

