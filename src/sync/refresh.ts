// "Refresh now" and the scheduled job share this: RMI sync, then SAP sync, then rebuild open reports.
// One refresh at a time per process; a second request waits for the running one instead of starting another.
import { syncRmi } from "./rmi-sync";
import { syncSap } from "./sap-sync";
import { rebuildDesignMap } from "./design-match";
import { openCohorts, writeReports } from "@/report/generate";
import { publishToCloud } from "./publish";

let running: Promise<string> | null = null;

export function refreshAll(): Promise<string> {
  if (!running) {
    running = (async () => {
      const parts: string[] = [];
      const errors: string[] = [];
      try {
        const r = await syncRmi();
        parts.push(`RMI ${r.exportRows} rows (${r.added} new, ${r.changed} changed)`);
      } catch (e) {
        errors.push(`RMI: ${(e as Error).message}`);
      }
      try {
        const s = await syncSap();
        parts.push(s.skipped ? "SAP skipped" : `SAP ${"lines" in s ? s.lines : 0} invoice lines`);
      } catch (e) {
        errors.push(`SAP: ${(e as Error).message}`);
      }
      try {
        // Again after SAP: undecided designs are settled from the freshest SAP sales and customer data.
        await rebuildDesignMap();
      } catch (e) {
        errors.push(`Design links: ${(e as Error).message}`);
      }
      try {
        const w = await writeReports(await openCohorts());
        parts.push(`${w.length} reports`);
      } catch (e) {
        errors.push(`Reports: ${(e as Error).message}`);
      }
      try {
        // Copy the dashboard tables to the cloud database (Vercel dashboard), if PUBLISH_DATABASE_URL is set.
        const p = await publishToCloud();
        if (!p.skipped) parts.push("published to cloud");
      } catch (e) {
        errors.push(`Publish: ${(e as Error).message}`);
      }
      if (errors.length) throw new Error(errors.join(" | "));
      return parts.join(", ");
    })().finally(() => {
      running = null;
    });
  }
  return running;
}
