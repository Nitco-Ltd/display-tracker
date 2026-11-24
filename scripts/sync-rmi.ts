// npm run sync:rmi [-- --catalog]   (--catalog forces a product catalogue refresh)
import "./env";
import { syncRmi } from "@/sync/rmi-sync";
import { closeDb } from "@/db/client";

const forceCatalog = process.argv.includes("--catalog");
syncRmi({ forceCatalog })
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
  })
  .catch(() => {
    process.exitCode = 1; // error already logged + recorded in sync_runs
  })
  .finally(closeDb);
