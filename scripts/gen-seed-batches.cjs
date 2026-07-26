const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('src/data/cardCatalogSeed.json', 'utf8'));

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function jsonb(v) {
  return `'${esc(JSON.stringify(v))}'::jsonb`;
}

fs.mkdirSync('scripts/seed-batches', { recursive: true });
const batches = [];
for (let i = 0; i < seed.length; i += 4) {
  const slice = seed.slice(i, i + 4);
  const rows = slice
    .map((c) => {
      const fee = c.default_annual_fee == null ? 'NULL' : c.default_annual_fee;
      return `('${esc(c.bank_name)}', '${esc(c.card_name)}', '${esc(c.network)}', ${jsonb(c.default_benefits)}, ${fee}, '${esc(c.card_color_theme)}')`;
    })
    .join(',\n');
  const sql = `insert into public.card_catalog (bank_name, card_name, network, default_benefits, default_annual_fee, card_color_theme)
values
${rows}
on conflict (bank_name, card_name) do update set
  network = excluded.network,
  default_benefits = excluded.default_benefits,
  default_annual_fee = excluded.default_annual_fee,
  card_color_theme = excluded.card_color_theme;`;
  batches.push(sql);
  fs.writeFileSync(`scripts/seed-batches/${batches.length - 1}.sql`, sql);
}
fs.writeFileSync('scripts/seed-batches/index.json', JSON.stringify({ count: batches.length }));
console.log('batches', batches.length);
