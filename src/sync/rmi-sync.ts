// RMI sync: list + export (+ weekly product catalogue) -> rmi_display, rmi_product, design_material_map.
// ~2 calls per run (plus ~26 once a week). Never one call per row.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { RmiClient, type RmiDisplayRow } from "@/adapters/rmi";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { upsertMany } from "@/db/upsert";
import { log } from "@/lib/log";
import {
  normalizeCassetteType,
  normalizeDealerName,
  normalizeDisplayedWhere,
  normalizePanelSize,
  normalizeProductType,
  normalizeTileSize,
  parseRmiDate,
} from "@/lib/normalize";
import { rebuildDesignMap } from "./design-match";
import { packagingFamilies } from "@/sales/window";
import { sameBoxTwins } from "@/sales/packaging";
import { getState, nowIso, setState, startRun } from "./runs";

const CATALOG_MAX_AGE_DAYS = 7;

export interface RmiSyncResult {
  runId: number;
  listRows: number;
  exportRows: number;
  added: number;
  changed: number;
  removed: number;
  products: number | null;
  mapping: Record<string, number>;
  warnings: string[];
}

export async function syncRmi(opts: { forceCatalog?: boolean } = {}): Promise<RmiSyncResult> {
  await ensureSchema();
  const run = await startRun("rmi");
  try {
    const rmi = new RmiClient();
    const db = getDb();
    const t = tables();
    const warnings: string[] = [];

    // 1) List: ids + status of every record.
    const list = await rmi.getDisplayList();
    await run.saveRaw("rmi_list_json", list.raw);
    log.info(`[rmi] list: ${list.rows.length} records`);

    // 2) Export: all report columns A–U.
    const exp = await rmi.getDisplayExport();
    await run.saveRaw("rmi_export_xlsx_b64", exp.rawBase64);
    log.info(`[rmi] export: ${exp.rows.length} rows`);

    // Sanity: list and export should describe the same records.
    const listById = new Map(list.rows.map((r) => [r.refNo, r]));
    const exportRefs = new Set(exp.rows.map((r) => r.refNo));
    const onlyInList = list.rows.filter((r) => !exportRefs.has(r.refNo)).length;
    const onlyInExport = exp.rows.filter((r) => !listById.has(r.refNo)).length;
    if (onlyInList || onlyInExport) warnings.push(`list/export mismatch: ${onlyInList} only in list, ${onlyInExport} only in export`);
    if (exp.rows.length < 0.9 * list.rows.length) {
      throw new Error(`export returned ${exp.rows.length} rows but list has ${list.rows.length}; refusing to mark rows removed`);
    }

    // 3) Product catalogue, weekly.
    let products: number | null = null;
    const lastCat = await getState("rmi_catalog_synced_at");
    if (opts.forceCatalog || !lastCat || Date.now() - Date.parse(lastCat) > CATALOG_MAX_AGE_DAYS * 86_400_000) {
      const cat = await rmi.getProductCatalog();
      const now = nowIso();
      const unique = [...new Map(cat.map((p) => [p.productCode, p])).values()];
      await upsertMany(
        t.rmiProduct,
        unique.map((p) => ({ productCode: p.productCode, productName: p.productName, category: p.category, size: p.size, lastSeenAt: now })),
        t.rmiProduct.productCode,
      );
      await setState("rmi_catalog_synced_at", now);
      products = unique.length;
      log.info(`[rmi] product catalogue: ${products} products`);
    }

    // 4) Upsert display rows.
    const now = nowIso();
    const existing = new Map(
      (await db.select({ refNo: t.rmiDisplay.refNo, rowHash: t.rmiDisplay.rowHash, firstSeenAt: t.rmiDisplay.firstSeenAt, changedAt: t.rmiDisplay.changedAt, inSource: t.rmiDisplay.inSource }).from(t.rmiDisplay)).map((r) => [r.refNo, r]),
    );
    let added = 0;
    let changed = 0;
    const badDates: string[] = [];
    const values = exp.rows.map((r) => {
      const hash = rowHash(r);
      const prev = existing.get(r.refNo);
      if (!prev) added++;
      else if (prev.rowHash !== hash) changed++;
      const iso = parseRmiDate(r.displayDate);
      if (!iso || iso > now.slice(0, 10)) badDates.push(`${r.refNo} (${r.displayDate})`);
      return {
        refNo: r.refNo,
        displayTrackerId: listById.get(r.refNo)?.id ?? null,
        displayDate: iso,
        cohortMonth: iso ? iso.slice(0, 7) : null,
        displayDateRaw: r.displayDate,
        rmiName: r.rmiName,
        dealerCode: r.dealerCode,
        dealerNameRaw: r.dealerName,
        dealerName: normalizeDealerName(r.dealerCode, r.dealerName),
        dealerStatus: r.dealerStatus,
        zone: r.zone,
        region: r.region,
        location: r.location,
        dealerCategory: r.dealerCategory,
        franchiseType: r.franchiseType,
        displayedWhere: r.displayedWhere,
        displayedWhereNorm: normalizeDisplayedWhere(r.displayedWhere),
        cassetteType: r.cassetteType,
        cassetteTypeNorm: normalizeCassetteType(r.cassetteType),
        cassetteNumber: r.cassetteNumber,
        panelNo: r.panelNo,
        panelSize: r.panelSize,
        panelSizeNorm: normalizePanelSize(r.panelSize),
        productType: r.productType,
        productTypeNorm: normalizeProductType(r.productType),
        sizeMm: r.sizeMm,
        sizeMmNorm: normalizeTileSize(r.sizeMm) || null,
        designName: r.designName,
        designStatus: r.designStatus,
        status: r.status,
        inSource: 1,
        rowHash: hash,
        firstSeenAt: prev?.firstSeenAt ?? now,
        lastSeenAt: now,
        changedAt: !prev ? now : prev.rowHash !== hash ? now : prev.changedAt,
        // keep current mapping until rebuildDesignMap() runs below
      };
    });
    await upsertMany(t.rmiDisplay, values, t.rmiDisplay.refNo, { keep: ["materialCode", "mapStatus"] });

    // Rows RMI no longer returns: keep them, flag them.
    const gone = [...existing.values()].filter((r) => r.inSource === 1 && !exportRefs.has(r.refNo));
    for (const g of gone) {
      await db.update(t.rmiDisplay).set({ inSource: 0, changedAt: now }).where(eq(t.rmiDisplay.refNo, g.refNo));
    }
    if (badDates.length) warnings.push(`${badDates.length} row(s) with a missing or future display date: ${badDates.slice(0, 5).join(", ")}`);

    // 5) Design -> material mapping.
    const mapping = await rebuildDesignMap();
    // Twin codes in the same box size that BOTH sell: counted as one tile, but a person should confirm they are one product.
    {
      const { familyOf, codesOf } = await packagingFamilies();
      const shown = (await db.selectDistinct({ c: t.rmiDisplay.materialCode }).from(t.rmiDisplay)).map((r) => r.c);
      const selling = new Set((await db.selectDistinct({ c: t.sapSalesMonthly.materialCode }).from(t.sapSalesMonthly)).map((r) => r.c));
      const families = new Set(shown.map((c) => (c ? familyOf.get(c) : undefined)).filter((f): f is string => !!f));
      const doubtful = sameBoxTwins([...families].map((f) => (codesOf.get(f) ?? []).filter((c) => selling.has(c))));
      if (doubtful.length)
        warnings.push(`${doubtful.length} displayed tile(s) sell under two codes with the same box size (counted as one tile; confirm with sales ops): ${doubtful.slice(0, 5).map((c) => c.join("/")).join(", ")}`);
    }

    const result: RmiSyncResult = {
      runId: run.id,
      listRows: list.rows.length,
      exportRows: exp.rows.length,
      added,
      changed,
      removed: gone.length,
      products,
      mapping,
      warnings,
    };
    for (const w of warnings) log.warn(`[rmi] ${w}`);
    await run.finish("ok", {
      rowsRead: exp.rows.length,
      rowsWritten: added + changed + gone.length,
      message: `${exp.rows.length} rows (${added} new, ${changed} changed, ${gone.length} removed); mapping ${JSON.stringify(mapping)}${warnings.length ? "; warnings: " + warnings.join(" | ") : ""}`,
    });
    return result;
  } catch (e) {
    await run.fail(e);
    throw e;
  }
}

function rowHash(r: RmiDisplayRow): string {
  return createHash("sha1").update(JSON.stringify(r)).digest("hex");
}

