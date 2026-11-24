// Writes report files to REPORT_OUTPUT_DIR. Used by `npm run build:report` and the scheduled job.
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isNotNull } from "drizzle-orm";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { config } from "@/lib/config";
import { log } from "@/lib/log";
import { addMonths, WINDOW_AFTER } from "@/sales/window";
import { startRun } from "@/sync/runs";
import { buildReportBuffer, reportFileName } from "./excel";

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Cohort months whose 14-month window hasn't closed yet and that have at least one display. */
export async function openCohorts(now = new Date()): Promise<string[]> {
  const t = tables();
  const cur = currentMonth(now);
  const first = addMonths(cur, -WINDOW_AFTER);
  const rows = await getDb().selectDistinct({ m: t.rmiDisplay.cohortMonth }).from(t.rmiDisplay).where(isNotNull(t.rmiDisplay.cohortMonth));
  return rows
    .map((r) => r.m!)
    .filter((m) => m >= first && m <= cur)
    .sort();
}

export async function writeReports(months: string[], outDir = config().REPORT_OUTPUT_DIR) {
  await ensureSchema();
  const run = await startRun("report");
  const dir = resolve(outDir);
  const written: { month: string; file: string; rows: number }[] = [];
  try {
    mkdirSync(dir, { recursive: true });
    for (const m of months) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error(`Invalid month "${m}" — use YYYY-MM, e.g. 2026-08`);
      const { buffer, rows } = await buildReportBuffer(m);
      const file = join(dir, reportFileName(m));
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, buffer);
      try {
        renameSync(tmp, file); // atomic: synced folders never see a half-written file
      } catch (e) {
        rmSync(tmp, { force: true });
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "EBUSY" || code === "EPERM") throw new Error(`${file} is open in Excel (or locked). Close it and run again.`);
        throw e;
      }
      written.push({ month: m, file, rows });
      log.info(`[report] ${reportFileName(m)}: ${rows} rows`);
    }
    await run.finish("ok", { rowsWritten: written.reduce((a, w) => a + w.rows, 0), message: `${written.length} report(s) in ${dir}` });
    return written;
  } catch (e) {
    await run.fail(e);
    throw e;
  }
}
