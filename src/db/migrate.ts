// Applies pending migrations for the active dialect. Safe to call on every run.
import { migrate as migrateLibsql } from "drizzle-orm/libsql/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { getDb, dialectOf } from "./client";
import { config } from "@/lib/config";

let done = false;
export async function ensureSchema(): Promise<void> {
  if (done) return;
  const db = getDb();
  if (dialectOf(config().DATABASE_URL) === "postgres") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePg(db as any, { migrationsFolder: "./drizzle/pg" });
  } else {
    await migrateLibsql(db, { migrationsFolder: "./drizzle/sqlite" });
  }
  done = true;
}
