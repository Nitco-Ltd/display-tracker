// SAP sync: billing lines (incremental) + material and customer master (weekly) -> sap_sales_monthly.
//
// Incremental rule: fetch documents changed since the last successful sync, PLUS re-read every document
// with a billing date in the last SAP_RECHECK_MONTHS months (catches corrections the change stamp misses).
// First run: everything from SAP_FIRST_BILLING_DATE.
//
// Sales rule (PENDING business confirmation, see docs/sap-api.md §4):
//   - document type in SAP_SALES_DOC_TYPES  -> +quantity, +value
//   - document type in SAP_RETURN_DOC_TYPES -> −quantity, −value
//   - document type in SAP_VALUE_ONLY_DOC_TYPES -> −value only (rate-difference / claim credit notes)
//   - cancelled documents and every other type (cancellations S1/S2, pro forma, …) -> ignored
//   - month = billing date; value = NetAmount (net of tax); volume converted to SAP_VOLUME_UNIT (m²)
import { config, csv } from "@/lib/config";
import { SapClient } from "@/adapters/sap";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { upsertMany } from "@/db/upsert";
import { log } from "@/lib/log";
import { getState, nowIso, setState, startRun } from "./runs";

const MATERIAL_MAX_AGE_DAYS = 7;

function monthsAgoFirstDay(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

export async function syncSap(opts: { full?: boolean; forceMaterials?: boolean } = {}) {
  await ensureSchema();
  const run = await startRun("sap");
  if (!config().SAP_ODATA_BASE_URL) {
    await run.finish("skipped", { message: "SAP not configured yet (SAP_ODATA_BASE_URL is blank in .env)" });
    return { skipped: true };
  }
  try {
    const sap = new SapClient();
    const t = tables();
    const startedAt = nowIso();

    // 1) Materials (weekly)
    let materials = 0;
    const lastMat = await getState("sap_materials_synced_at");
    if (opts.forceMaterials || !lastMat || Date.now() - Date.parse(lastMat) > MATERIAL_MAX_AGE_DAYS * 86_400_000) {
      for await (const page of sap.materials()) {
        await upsertMany(t.sapMaterial, page.map((m) => ({ ...m, lastSeenAt: startedAt })), t.sapMaterial.material);
        materials += page.length;
      }
      await setState("sap_materials_synced_at", startedAt);
      log.info(`[sap] materials: ${materials}`);
    }

    // 1b) Customers (weekly): GST number + PIN code, to link a dealer's several accounts. Optional: if the SAP user
    //     can't read the customer master, sales still work, just without linked accounts.
    let customers = 0;
    const lastCust = await getState("sap_customers_synced_at");
    if (opts.forceMaterials || !lastCust || Date.now() - Date.parse(lastCust) > MATERIAL_MAX_AGE_DAYS * 86_400_000) {
      try {
        for await (const page of sap.customers()) {
          await upsertMany(t.sapCustomer, page.map((c) => ({ ...c, lastSeenAt: startedAt })), t.sapCustomer.customer);
          customers += page.length;
        }
        await setState("sap_customers_synced_at", startedAt);
        log.info(`[sap] customers: ${customers}`);
      } catch (e) {
        log.warn(`[sap] customer master not read (${(e as Error).message.slice(0, 200)}); linked dealer accounts not refreshed`);
      }
    }

    // 2) Billing lines
    const lastSync = opts.full ? null : await getState("sap_billing_synced_at");
    const windows = lastSync
      ? [{ changedSince: lastSync }, { dateFrom: monthsAgoFirstDay(config().SAP_RECHECK_MONTHS) }]
      : [{ dateFrom: config().SAP_FIRST_BILLING_DATE }];
    let lines = 0;
    for (const w of windows) {
      for await (const page of sap.billingLines(w)) {
        await upsertMany(
          t.sapBillingItem,
          page.map((l) => ({ ...l, isCancelled: l.isCancelled ? 1 : 0, fetchedAt: startedAt })),
          [t.sapBillingItem.billingDocument, t.sapBillingItem.item],
        );
        lines += page.length;
      }
    }
    log.info(`[sap] billing lines fetched: ${lines}`);

    // 3) Monthly aggregates (full recompute — cheap, and always consistent)
    const agg = await rebuildMonthlySales();
    await setState("sap_billing_synced_at", startedAt);
    await run.finish("ok", {
      rowsRead: lines,
      rowsWritten: agg.rows,
      message: `${lines} billing lines, ${materials} materials, ${customers} customers, ${agg.rows} dealer×material×month rows; ${agg.noVolume} lines without m² conversion`,
    });
    return { skipped: false, lines, materials, customers, ...agg };
  } catch (e) {
    await run.fail(e);
    throw e;
  }
}

export async function rebuildMonthlySales(): Promise<{ rows: number; noVolume: number }> {
  const db = getDb();
  const t = tables();
  const sales = new Set(csv(config().SAP_SALES_DOC_TYPES));
  const returns = new Set(csv(config().SAP_RETURN_DOC_TYPES));
  const valueOnly = new Set(csv(config().SAP_VALUE_ONLY_DOC_TYPES));
  const volUnit = config().SAP_VOLUME_UNIT.toUpperCase();
  const conv = new Map((await db.select().from(t.sapMaterial)).map((m) => [m.material, m.volumePerBaseUnit]));

  const acc = new Map<string, { dealerCode: string; materialCode: string; month: string; volume: number; value: number; lineCount: number; volumeIncomplete: number }>();
  let noVolume = 0;
  for (const l of await db.select().from(t.sapBillingItem)) {
    if (l.isCancelled || !l.soldTo || !l.material || !l.billingDate || !l.docType) continue;
    const isValueOnly = valueOnly.has(l.docType);
    const sign = sales.has(l.docType) ? 1 : returns.has(l.docType) || isValueOnly ? -1 : 0;
    if (!sign) continue;
    let vol: number | null = null;
    if (isValueOnly) vol = 0;
    else if (l.quantityUnit?.toUpperCase() === volUnit) vol = l.quantity;
    else if (l.quantityBase !== null && conv.get(l.material)) vol = l.quantityBase * conv.get(l.material)!;
    if (vol === null) noVolume++;
    const key = `${l.soldTo}|${l.material}|${l.billingDate.slice(0, 7)}`;
    const a = acc.get(key) ?? { dealerCode: l.soldTo, materialCode: l.material, month: l.billingDate.slice(0, 7), volume: 0, value: 0, lineCount: 0, volumeIncomplete: 0 };
    a.volume += sign * (vol ?? 0);
    a.value += sign * (l.netAmount ?? 0);
    a.lineCount++;
    if (vol === null) a.volumeIncomplete = 1;
    acc.set(key, a);
  }
  const now = nowIso();
  const rows = [...acc.values()].map((a) => ({ ...a, volume: +a.volume.toFixed(3), value: +a.value.toFixed(3), updatedAt: now }));
  await db.transaction(async (tx) => {
    await tx.delete(t.sapSalesMonthly);
    for (let i = 0; i < rows.length; i += 500) await tx.insert(t.sapSalesMonthly).values(rows.slice(i, i + 500));
  });
  return { rows: rows.length, noVolume };
}
