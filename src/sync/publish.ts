// Copies the tables the dashboard reads from the local database (the sync PC) to the cloud Postgres
// (PUBLISH_DATABASE_URL, e.g. Neon) that the Vercel dashboard uses. Raw invoice lines, raw payloads and
// sync state stay local: the cloud copy is ~40 MB instead of ~400 MB.
//
// One transaction per run: viewers keep seeing the previous data until the new copy is complete.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { desc } from "drizzle-orm";
import postgres from "postgres";
import * as pg from "@/db/schema.pg";
import { getDb, tables } from "@/db/client";
import { config } from "@/lib/config";
import { log } from "@/lib/log";
import { startRun } from "./runs";

/** Dashboard tables, in insert order. */
const TABLES = ["rmiDisplay", "sapSalesMonthly", "sapMaterial", "sapCustomer", "designMaterialMap", "syncRuns", "appUser"] as const;
const SYNC_RUNS_KEPT = 300;
const MAX_PARAMS = 30_000; // Postgres allows 65,535 bind parameters per statement

export async function publishToCloud(): Promise<{ skipped: boolean; rows?: Record<string, number> }> {
  const url = config().PUBLISH_DATABASE_URL;
  if (!url) return { skipped: true };
  const run = await startRun("publish");
  const sql = postgres(url, { max: 1, ssl: /sslmode=disable/.test(url) ? false : "require", connect_timeout: 30 });
  try {
    const cloud = drizzle(sql, { schema: pg });
    await migrate(cloud, { migrationsFolder: "./drizzle/pg" });

    const local = getDb();
    const t = tables();
    const data: Record<string, Record<string, unknown>[]> = {};
    for (const name of TABLES) {
      data[name] =
        name === "syncRuns"
          ? await local.select().from(t.syncRuns).orderBy(desc(t.syncRuns.id)).limit(SYNC_RUNS_KEPT)
          : await local.select().from(t[name]);
    }

    const rows: Record<string, number> = {};
    await cloud.transaction(async (tx) => {
      for (const name of [...TABLES].reverse()) await tx.delete(pg[name]);
      for (const name of TABLES) {
        const list = data[name];
        rows[name] = list.length;
        if (!list.length) continue;
        const chunk = Math.max(1, Math.floor(MAX_PARAMS / Object.keys(list[0]).length));
        for (let i = 0; i < list.length; i += chunk) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.insert(pg[name]).values(list.slice(i, i + chunk) as any);
        }
      }
    });
    const total = Object.values(rows).reduce((a, b) => a + b, 0);
    log.info(`[publish] ${total} rows copied to the cloud database`);
    await run.finish("ok", { rowsWritten: total, message: Object.entries(rows).map(([k, v]) => `${k} ${v}`).join(", ") });
    return { skipped: false, rows };
  } catch (e) {
    await run.fail(e);
    throw e;
  } finally {
    await sql.end();
  }
}
