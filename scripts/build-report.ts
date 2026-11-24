// npm run build:report -- --month 2026-08            one cohort month
// npm run build:report -- --month 2026-07,2026-08    several
// npm run build:report                               every cohort month still inside its 14-month window
// npm run build:report -- --out "C:\Users\me\OneDrive\Reports"   override REPORT_OUTPUT_DIR
import "./env";
import { closeDb } from "@/db/client";
import { openCohorts, writeReports } from "@/report/generate";
import { ensureSchema } from "@/db/migrate";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(name + "="));
  return eq?.slice(name.length + 1);
}

async function main() {
  await ensureSchema();
  const monthArg = arg("--month");
  const months = monthArg ? monthArg.split(",").map((s) => s.trim()) : await openCohorts();
  if (!months.length) {
    console.log("No cohort months to build (run `npm run sync:rmi` first).");
    return;
  }
  const out = await writeReports(months, arg("--out"));
  for (const w of out) console.log(`${w.month}  ${w.rows} rows  ->  ${w.file}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
