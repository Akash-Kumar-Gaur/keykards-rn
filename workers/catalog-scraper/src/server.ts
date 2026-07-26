/**
 * Authenticated HTTP trigger for "run now" (Railway service + CRON_SECRET).
 *
 * POST /run  Authorization: Bearer <CRON_SECRET>
 * GET  /health
 */

import http from 'http';
import { assertRuntimeConfig, config } from './config.js';
import { runCatalogScrape } from './pipeline.js';

let running = false;

function unauthorized(res: http.ServerResponse) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function main() {
  assertRuntimeConfig();
  if (!config.cronSecret) {
    console.warn('[server] CRON_SECRET not set — /run will reject all requests');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/run') {
      const auth = req.headers.authorization ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!config.cronSecret || token !== config.cronSecret) {
        unauthorized(res);
        return;
      }
      if (running) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'already running' }));
        return;
      }

      let limit: number | undefined;
      try {
        const body = await readBody(req);
        if (body) {
          const parsed = JSON.parse(body) as { limit?: number };
          if (parsed.limit) limit = Number(parsed.limit);
        }
      } catch {
        /* ignore body */
      }

      running = true;
      try {
        const summary = await runCatalogScrape({ limit });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(summary));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        running = false;
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(config.port, () => {
    console.log(`[server] listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
