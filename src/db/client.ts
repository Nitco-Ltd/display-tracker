// Database connection. The dialect is chosen from DATABASE_URL alone:
//   file:./data/app.db          -> SQLite (libsql driver, no native build needed on Windows)
//   postgres://… / postgresql:// -> Postgres (postgres-js driver)
// Application code imports `db` and `t` (tables) from here and never touches a dialect directly.
// The query-builder API we use (select/insert/onConflictDoUpdate/delete) is identical for both,
// so `db` is typed as the SQLite flavour for convenience.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle as drizzleLibsql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { createClient } from "@libsql/client";
import postgres from "postgres";
import * as sqliteSchema from "./schema.sqlite";
import * as pgSchema from "./schema.pg";
import { config } from "@/lib/config";

export type Dialect = "sqlite" | "postgres";

export function dialectOf(url: string): Dialect {
  return /^postgres(ql)?:\/\//i.test(url) ? "postgres" : "sqlite";
}

type Db = LibSQLDatabase<typeof sqliteSchema>;

let _db: Db | undefined;
let _close: (() => Promise<void>) | undefined;

export function getDb(): Db {
  if (_db) return _db;
  const url = config().DATABASE_URL;
  if (dialectOf(url) === "postgres") {
    const sql = postgres(url, { max: 5 });
    _db = drizzlePg(sql, { schema: pgSchema }) as unknown as Db;
    _close = () => sql.end();
  } else {
    const path = url.replace(/^file:/, "");
    if (!path.startsWith(":")) mkdirSync(dirname(path), { recursive: true });
    const client = createClient({ url });
    _db = drizzleLibsql(client, { schema: sqliteSchema });
    _close = async () => client.close();
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  await _close?.();
  _db = undefined;
  _close = undefined;
}

/** Tables for the active dialect (typed as the SQLite variants, see note above). */
export function tables(): typeof sqliteSchema {
  return (dialectOf(config().DATABASE_URL) === "postgres" ? pgSchema : sqliteSchema) as unknown as typeof sqliteSchema;
}
