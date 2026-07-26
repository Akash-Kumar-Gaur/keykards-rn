const fs = require('fs');
const src = fs.readFileSync(
  'C:/Users/PC/Desktop/Projects/modern-react-app/scripts/fetch-card-benefits.mjs',
  'utf8',
);
const start = src.indexOf('const SOURCES = [');
const end = src.indexOf('\n];', start);
if (start < 0 || end < 0) {
  console.error('SOURCES not found');
  process.exit(1);
}
const block = src.slice(start, end + 3);
const count = (block.match(/^\s+id:/gm) || []).length;
fs.mkdirSync('workers/catalog-scraper/src', { recursive: true });
fs.writeFileSync(
  'workers/catalog-scraper/src/sources.ts',
  `/**
 * Source registry — reused from Benefit Radar scripts/fetch-card-benefits.mjs
 * (${count} entries). Adjustments noted in README.
 */

export type CatalogSource = {
  id: string;
  name: string;
  issuer: string;
  network: string;
  annualFee?: number;
  type?: string;
  urls: string[];
  fallbackUrls?: string[];
  /** Prefer Playwright when static HTML is thin / JS-rendered. */
  preferPlaywright?: boolean;
};

${block.replace('const SOURCES =', 'export const SOURCES: CatalogSource[] =')}
`,
);
console.log('wrote', count, 'sources');
