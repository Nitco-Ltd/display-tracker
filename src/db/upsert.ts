// Generic chunked upsert that works on SQLite and Postgres ("excluded.col" is valid in both).
import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable, SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb } from "./client";

export async function upsertMany<T extends SQLiteTable>(
  table: T,
  rows: T["$inferInsert"][],
  target: SQLiteColumn | SQLiteColumn[],
  opts: { keep?: string[]; chunk?: number } = {},
): Promise<number> {
  if (!rows.length) return 0;
  const cols = getTableColumns(table);
  const targets = new Set((Array.isArray(target) ? target : [target]).map((c) => c.name));
  const keep = new Set(opts.keep ?? []); // property names never overwritten on update (e.g. firstSeenAt)
  const set: Record<string, SQL> = {};
  for (const [prop, col] of Object.entries(cols)) {
    // Never overwrite the conflict target, primary keys (ids must stay stable) or explicitly kept columns.
    if (targets.has(col.name) || col.primary || keep.has(prop)) continue;
    set[prop] = sql.raw(`excluded."${col.name}"`);
  }
  const db = getDb();
  const size = opts.chunk ?? 200;
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.insert(table as any).values(rows.slice(i, i + size) as any) as any).onConflictDoUpdate({ target, set });
  }
  return rows.length;
}
