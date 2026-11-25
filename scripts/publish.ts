// npm run publish — copy the dashboard tables to the cloud Postgres (PUBLISH_DATABASE_URL) right now.
// The daily job does this automatically after each sync.
import "./env";
import { ensureSchema } from "@/db/migrate";
import { closeDb } from "@/db/client";
import { publishToCloud } from "@/sync/publish";

async function main() {
  await ensureSchema();
  const r = await publishToCloud();
  if (r.skipped) console.log("PUBLISH_DATABASE_URL is not set in .env — nothing to do.");
  else console.log("Published:", r.rows);
}
main()
  .catch((e) => {
    console.error("FAILED:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(closeDb);
