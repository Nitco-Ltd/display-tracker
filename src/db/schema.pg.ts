// Postgres schema. KEEP IN SYNC with schema.sqlite.ts — tests/schema-parity.test.ts checks this.
import { pgTable, text, integer, doublePrecision, serial, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  rowsRead: integer("rows_read"),
  rowsWritten: integer("rows_written"),
  message: text("message"),
  error: text("error"),
});

export const rawPayloads = pgTable("raw_payloads", {
  id: serial("id").primaryKey(),
  syncRunId: integer("sync_run_id"),
  kind: text("kind").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  body: text("body").notNull(),
});

export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at"),
});

export const rmiDisplay = pgTable(
  "rmi_display",
  {
    refNo: text("ref_no").primaryKey(),
    displayTrackerId: integer("display_tracker_id"),
    displayDate: text("display_date"),
    cohortMonth: text("cohort_month"),
    displayDateRaw: text("display_date_raw"),
    rmiName: text("rmi_name"),
    dealerCode: text("dealer_code"),
    dealerNameRaw: text("dealer_name_raw"),
    dealerName: text("dealer_name"),
    dealerStatus: text("dealer_status"),
    zone: text("zone"),
    region: text("region"),
    location: text("location"),
    dealerCategory: text("dealer_category"),
    franchiseType: text("franchise_type"),
    displayedWhere: text("displayed_where"),
    displayedWhereNorm: text("displayed_where_norm"),
    cassetteType: text("cassette_type"),
    cassetteTypeNorm: text("cassette_type_norm"),
    cassetteNumber: text("cassette_number"),
    panelNo: text("panel_no"),
    panelSize: text("panel_size"),
    panelSizeNorm: text("panel_size_norm"),
    productType: text("product_type"),
    productTypeNorm: text("product_type_norm"),
    sizeMm: text("size_mm"),
    sizeMmNorm: text("size_mm_norm"),
    designName: text("design_name"),
    designStatus: text("design_status"),
    status: text("status"),
    materialCode: text("material_code"),
    mapStatus: text("map_status"),
    inSource: integer("in_source").notNull().default(1),
    rowHash: text("row_hash"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    changedAt: text("changed_at"),
  },
  (t) => [index("ix_display_cohort").on(t.cohortMonth), index("ix_display_dealer").on(t.dealerCode)],
);

export const rmiProduct = pgTable("rmi_product", {
  productCode: text("product_code").primaryKey(),
  productName: text("product_name").notNull(),
  category: text("category"),
  size: text("size"),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const designMaterialMap = pgTable(
  "design_material_map",
  {
    id: serial("id").primaryKey(),
    designKey: text("design_key").notNull(),
    sizeKey: text("size_key").notNull(),
    designName: text("design_name").notNull(),
    sizeMm: text("size_mm"),
    materialCode: text("material_code"),
    materialName: text("material_name"),
    method: text("method").notNull(),
    confidence: doublePrecision("confidence"),
    status: text("status").notNull(),
    candidates: text("candidates"),
    rowCount: integer("row_count"),
    note: text("note"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("ux_map_key").on(t.designKey, t.sizeKey)],
);

export const sapBillingItem = pgTable(
  "sap_billing_item",
  {
    billingDocument: text("billing_document").notNull(),
    item: text("item").notNull(),
    docType: text("doc_type"),
    docCategory: text("doc_category"),
    billingDate: text("billing_date"),
    soldTo: text("sold_to"),
    salesOrg: text("sales_org"),
    distChannel: text("dist_channel"),
    division: text("division"),
    material: text("material"),
    quantity: doublePrecision("quantity"),
    quantityUnit: text("quantity_unit"),
    quantityBase: doublePrecision("quantity_base"),
    baseUnit: text("base_unit"),
    netAmount: doublePrecision("net_amount"),
    taxAmount: doublePrecision("tax_amount"),
    currency: text("currency"),
    isCancelled: integer("is_cancelled").notNull().default(0),
    lastChange: text("last_change"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.billingDocument, t.item] }),
    index("ix_bill_sold_mat").on(t.soldTo, t.material),
    index("ix_bill_date").on(t.billingDate),
  ],
);

export const sapMaterial = pgTable("sap_material", {
  material: text("material").primaryKey(),
  description: text("description"),
  productType: text("product_type"),
  productGroup: text("product_group"),
  baseUnit: text("base_unit"),
  volumePerBaseUnit: doublePrecision("volume_per_base_unit"),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const sapSalesMonthly = pgTable(
  "sap_sales_monthly",
  {
    dealerCode: text("dealer_code").notNull(),
    materialCode: text("material_code").notNull(),
    month: text("month").notNull(),
    volume: doublePrecision("volume").notNull(),
    value: doublePrecision("value").notNull(),
    lineCount: integer("line_count").notNull(),
    volumeIncomplete: integer("volume_incomplete").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.dealerCode, t.materialCode, t.month] })],
);
