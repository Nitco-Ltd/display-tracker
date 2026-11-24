// Design-review decisions are the only data that can't be re-pulled from RMI or SAP. Move them between databases:
//   npm run decisions -- export decisions.json     (from the database in DATABASE_URL)
//   npm run decisions -- import decisions.json     (into the database in DATABASE_URL)
import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { closeDb, getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { upsertMany } from "@/db/upsert";
import { rebuildDesignMap } from "@/sync/design-match";

async function main() {
  const [cmd, file] = process.argv.slice(2);
  if (!["export", "import"].includes(cmd) || !file) throw new Error("Usage: npm run decisions -- export|import <file.json>");
  await ensureSchema();
  const t = tables();
  if (cmd === "export") {
    const rows = await getDb().select().from(t.designMaterialMap).where(inArray(t.designMaterialMap.status, ["approved", "manual", "rejected"]));
    writeFileSync(file, JSON.stringify(rows.map(({ id: _id, ...r }) => r), null, 2));
    console.log(`Exported ${rows.length} decisions to ${file}`);
  } else {
    const rows = JSON.parse(readFileSync(file, "utf8"));
    await upsertMany(t.designMaterialMap, rows, [t.designMaterialMap.designKey, t.designMaterialMap.sizeKey]);
    const stats = await rebuildDesignMap();
    console.log(`Imported ${rows.length} decisions. Mapping now: ${JSON.stringify(stats)}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
