// npm run daily — the scheduled job: RMI sync -> SAP sync -> rebuild every open monthly report.
// Writes everything it prints to logs/daily-YYYY-MM.log, emails an alert on failure (if configured),
// and exits with code 1 on failure so Task Scheduler shows "Last Run Result" as an error.
import "./env";
import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "@/lib/config";
import { redact } from "@/lib/log";
import { sendAlert } from "@/lib/alert";
import { refreshAll } from "@/sync/refresh";
import { closeDb } from "@/db/client";

const dir = resolve(config().LOG_DIR);
mkdirSync(dir, { recursive: true });
const file = join(dir, `daily-${new Date().toISOString().slice(0, 7)}.log`);
for (const k of ["log", "warn", "error"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...args: unknown[]) => {
    orig(...args);
    try {
      appendFileSync(file, redact(args.map(String).join(" ")) + "\n");
    } catch {
      /* never fail the job because the log can't be written */
    }
  };
}

async function main() {
  console.log(`===== daily run ${new Date().toISOString()} =====`);
  try {
    const summary = await refreshAll();
    console.log(`DONE: ${summary}`);
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`FAILED: ${msg}`);
    await sendAlert(msg);
    process.exitCode = 1;
  }
}

main().finally(closeDb);
