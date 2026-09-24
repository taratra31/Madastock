import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// One-off: export every table of the SQLite dev.db into a portable JSON
// snapshot that the Render-side importer can read without a sqlite driver.

const sqlite = new PrismaClient({
  datasources: { db: { url: 'file:./dev.db' } },
});

const toJson = (v) => {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'object') {
    try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
  }
  return v;
};

const tables = await sqlite.$queryRawUnsafe(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name",
);

const dump = {};
for (const { name } of tables) {
  const rows = await sqlite.$queryRawUnsafe(`SELECT * FROM "${name}"`);
  dump[name] = rows.map((r) => {
    const o = {};
    for (const k of Object.keys(r)) o[k] = toJson(r[k]);
    return o;
  });
  console.log(`${name}: ${rows.length}`);
}

writeFileSync('prisma/dev.db.sync.json', JSON.stringify(dump));
console.log('snapshot written -> prisma/dev.db.sync.json');
await sqlite.$disconnect();