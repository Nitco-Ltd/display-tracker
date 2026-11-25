// In-memory cache for the dashboard's data, valid until the data changes.
//
// Every page used to reload all displays and sales (12k displays, 100k sales rows) on every click: ~2 s against
// the cloud database. The data only changes when a sync or publish runs, so we keep it in memory and check a
// cheap "data version" (the newest sync_runs id) at most every 20 s. A new sync or publish = a new version =
// everything is reloaded once. Works the same on the PC (SQLite) and on Vercel (Postgres, per warm instance).
// (No "server-only" import: the report builder used by the scheduled job also goes through here.)
import { desc } from "drizzle-orm";
import { getDb, tables } from "@/db/client";

const CHECK_EVERY_MS = 20_000;
let version: string | null = null;
let checkedAt = 0;
let pending: Promise<string> | null = null;
const store = new Map<string, Promise<unknown>>();

async function readVersion(): Promise<string> {
  const t = tables();
  const [r] = await getDb().select({ id: t.syncRuns.id, s: t.syncRuns.status, f: t.syncRuns.finishedAt }).from(t.syncRuns).orderBy(desc(t.syncRuns.id)).limit(1);
  return r ? `${r.id}|${r.s}|${r.f ?? ""}` : "empty";
}

async function currentVersion(): Promise<string> {
  if (version && Date.now() - checkedAt < CHECK_EVERY_MS) return version;
  pending ??= readVersion().finally(() => (pending = null));
  const v = await pending;
  checkedAt = Date.now();
  if (v !== version) {
    store.clear();
    version = v;
  }
  return v;
}

/** Load once per data version. Failed loads are not cached. */
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  await currentVersion();
  let p = store.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().catch((e) => {
      store.delete(key);
      throw e;
    });
    store.set(key, p);
  }
  return p;
}

/** After a refresh in this process: drop everything now instead of waiting for the next version check. */
export function invalidateDataCache() {
  store.clear();
  version = null;
  checkedAt = 0;
}
