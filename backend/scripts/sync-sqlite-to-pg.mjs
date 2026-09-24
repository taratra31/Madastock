import { readFileSync } from 'node:fs';
import { Client } from 'pg';

// Imports the committed SQLite snapshot (prisma/dev.db.sync.json) into the
// target PostgreSQL database (DATABASE_URL). Idempotent: ON CONFLICT DO
// NOTHING on primary keys, safe to run multiple times on one-time flag.

const targetUrl = process.env.DATABASE_URL;
if (!targetUrl || !targetUrl.startsWith('postgres')) {
  console.error('DATABASE_URL must point to PostgreSQL. Aborting import.');
  process.exit(1);
}

const dump = JSON.parse(readFileSync('prisma/dev.db.sync.json', 'utf8'));
const tableNames = Object.keys(dump);

async function main() {
  const pg = new Client({
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await pg.connect();

  const pgRes = await pg.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
  );
  const pgTables = new Set(pgRes.rows.map((r) => r.table_name));

  const pkRes = await pg.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  `);
  const pks = {};
  for (const r of pkRes.rows) (pks[r.table_name] ??= []).push(r.column_name);

  const fkRes = await pg.query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  const edges = fkRes.rows.map((r) => [r.child, r.parent]);

  const order = [];
  const visited = new Set();
  const visiting = new Set();
  function visit(t) {
    if (visited.has(t)) return;
    if (visiting.has(t)) throw new Error(`FK cycle at ${t}`);
    visiting.add(t);
    for (const [c, p] of edges) if (c === t) visit(p);
    visiting.delete(t);
    visited.add(t);
    order.push(t);
  }
  for (const t of tableNames) visit(t);

  const colRes = await pg.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns WHERE table_schema = 'public'
  `);
  const colsByTable = {};
  for (const r of colRes.rows) (colsByTable[r.table_name] ??= []).push(r);

  const convert = (v, dataType) => {
    if (v === undefined || v === null || v === '') return null;
    if (dataType === 'boolean') {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      return v === '1' || String(v).toLowerCase() === 'true';
    }
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return v;
  };

  await pg.query('BEGIN');
  try {
    for (const t of [...order].reverse()) {
      if (pgTables.has(t)) await pg.query(`TRUNCATE TABLE "${t}" CASCADE`);
    }

    let totalOk = 0;
    for (const table of order) {
      const rows = dump[table] || [];
      if (!pgTables.has(table)) {
        console.log(`SKIP ${table} (not in pg)`);
        continue;
      }
      if (!rows.length) {
        console.log(`- ${table}: 0 rows`);
        continue;
      }
      const meta = colsByTable[table] || [];
      const pkCols = pks[table] || [];
      const conflict = pkCols.length
        ? ` ON CONFLICT ("${pkCols.join('","')}") DO NOTHING`
        : '';
      let ok = 0;
      let failed = 0;
      for (const row of rows) {
        const cols = [];
        const vals = [];
        for (const c of meta) {
          if (!(c.column_name in row)) continue;
          const value = convert(row[c.column_name], c.data_type);
          if (value === null) continue;
          cols.push(`"${c.column_name}"`);
          vals.push(value);
        }
        if (!cols.length) continue;
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
        try {
          await pg.query(
            `INSERT INTO "${table}" (${cols.join(',')}) VALUES (${placeholders})${conflict}`,
            vals,
          );
          ok++;
        } catch (e) {
          failed++;
          const key = pkCols.length ? row[pkCols[0]] : '(no pk)';
          console.error(`  !! ${table} ${String(key).slice(0, 40)}: ${e.message.split('\n')[0]}`);
        }
      }
      totalOk += ok;
      console.log(`- ${table}: ${ok} ok, ${failed} failed / ${rows.length} source`);
    }
    await pg.query('COMMIT');
    console.log(`IMPORT DONE (${totalOk} rows inserted/reconciled)`);
  } catch (e) {
    await pg.query('ROLLBACK');
    throw e;
  } finally {
    await pg.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});