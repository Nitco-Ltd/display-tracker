// npm run sync:sap                 incremental sync
// npm run sync:sap -- --full       re-read everything from SAP_FIRST_BILLING_DATE
// npm run sync:sap -- --materials  force material master refresh
// npm run sync:sap -- --probe      one tiny test call; prints the field names SAP returns
import "./env";
import { SapClient } from "@/adapters/sap";
import { syncSap } from "@/sync/sap-sync";
import { closeDb } from "@/db/client";

async function main() {
  if (process.argv.includes("--probe")) {
    console.log(JSON.stringify(await new SapClient().probe(), null, 2));
    return;
  }
  const r = await syncSap({ full: process.argv.includes("--full"), forceMaterials: process.argv.includes("--materials") });
  console.log(JSON.stringify(r, null, 2));
}

main()
  .catch((e) => {
    if (process.argv.includes("--probe")) console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
