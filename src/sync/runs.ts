// Records every sync in `sync_runs` (start, end, rows, status, error) and keeps raw payloads for debugging.
import { eq, lt, and } from "drizzle-orm";
import { getDb, tables } from "@/db/client";
import { config } from "@/lib/config";
import { log, redact } from "@/lib/log";

export const nowIso = () => new Date().toISOString();

export interface RunHandle {
  id: number;
  source: string;
  saveRaw(kind: string, body: string): Promise<void>;
  finish(status: "ok" | "skipped", stats: { rowsRead?: number; rowsWritten?: number; message?: string }): Promise<void>;
  fail(err: unknown): Promise<void>;
}

export async function startRun(source: "rmi" | "sap" | "report"): Promise<RunHandle> {
  const db = getDb();
  const t = tables();
  const [row] = await db
    .insert(t.syncRuns)
    .values({ source, startedAt: nowIso(), status: "running" })
    .returning({ id: t.syncRuns.id });
  const id = row.id;
  log.info(`[${source}] sync run #${id} started`);

  return {
    id,
    source,
    async saveRaw(kind, body) {
      await db.insert(t.rawPayloads).values({ syncRunId: id, kind, fetchedAt: nowIso(), body });
    },
    async finish(status, stats) {
      await db
        .update(t.syncRuns)
        .set({ status, finishedAt: nowIso(), ...stats })
        .where(eq(t.syncRuns.id, id));
      log.info(`[${source}] sync run #${id} ${status}: ${stats.message ?? ""}`);
      await pruneRaw();
    },
    async fail(err) {
      const msg = redact(err instanceof Error ? err.message : String(err));
      await db
        .update(t.syncRuns)
        .set({ status: "failed", finishedAt: nowIso(), error: msg.slice(0, 4000) })
        .where(eq(t.syncRuns.id, id));
      log.error(`[${source}] sync run #${id} FAILED: ${msg}`);
    },
  };
}

async function pruneRaw() {
  const cutoff = new Date(Date.now() - config().RAW_PAYLOAD_RETENTION_DAYS * 86_400_000).toISOString();
  const t = tables();
  await getDb().delete(t.rawPayloads).where(lt(t.rawPayloads.fetchedAt, cutoff));
}

export async function getState(key: string): Promise<string | null> {
  const t = tables();
  const r = await getDb().select().from(t.syncState).where(eq(t.syncState.key, key));
  return r[0]?.value ?? null;
}

export async function setState(key: string, value: string): Promise<void> {
  const t = tables();
  await getDb()
    .insert(t.syncState)
    .values({ key, value, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: t.syncState.key, set: { value, updatedAt: nowIso() } });
}

/** Last finished run per source, for the dashboard freshness banner. */
export async function lastRuns(source: string) {
  const t = tables();
  const rows = await getDb()
    .select()
    .from(t.syncRuns)
    .where(and(eq(t.syncRuns.source, source)))
    .orderBy(t.syncRuns.id);
  const ok = [...rows].reverse().find((r) => r.status === "ok");
  const latest = rows.at(-1);
  return { lastOk: ok, latest };
}
