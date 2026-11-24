// SAP S/4HANA OData (v2) adapter — the ONLY file that knows about SAP.
// READ-ONLY: this module only ever issues HTTP GET. Never add POST/PUT/PATCH/DELETE here.
// Services/fields are the standard S/4HANA APIs (API_BILLING_DOCUMENT_SRV, API_PRODUCT_SRV).
// STATUS: written against the standard API spec; not yet tested on NITCO's system (see docs/sap-api.md).
import { z } from "zod";
import { config, csv, requireConfig } from "@/lib/config";
import { request } from "@/lib/http";
import { log } from "@/lib/log";

export class SapShapeError extends Error {
  constructor(what: string, detail: string) {
    super(`SAP ${what} returned an unexpected shape (${detail}). Check the service/field names in docs/sap-api.md.`);
  }
}

export interface SapBillingLine {
  billingDocument: string;
  item: string;
  docType: string | null;
  docCategory: string | null;
  billingDate: string | null; // yyyy-mm-dd
  soldTo: string | null; // 10-digit, zero-padded (same as RMI Dealer_Code)
  salesOrg: string | null;
  distChannel: string | null;
  division: string | null;
  material: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  quantityBase: number | null;
  baseUnit: string | null;
  netAmount: number | null;
  taxAmount: number | null;
  currency: string | null;
  isCancelled: boolean;
  lastChange: string | null; // ISO timestamp
}

export interface SapMaterial {
  material: string;
  description: string | null;
  productType: string | null;
  productGroup: string | null;
  baseUnit: string | null;
  volumePerBaseUnit: number | null; // in SAP_VOLUME_UNIT per base unit
}

// ---------- OData v2 helpers ----------

/** "/Date(1690848000000)/" or "/Date(1690848000000+0000)/" -> Date */
export function odataDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = v.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
  if (m) return new Date(+m[1]);
  const d = new Date(v);
  return isNaN(+d) ? null : d;
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v).trim());

/** SAP often strips leading zeros on customer numbers in OData (ALPHA conversion). RMI uses 10 digits. */
export function padCustomer(v: string | null): string | null {
  return v && /^\d+$/.test(v) ? v.padStart(10, "0") : v;
}

const listEnvelope = z.object({
  d: z.union([
    z.object({ results: z.array(z.record(z.string(), z.unknown())), __next: z.string().optional() }),
    z.array(z.record(z.string(), z.unknown())),
  ]),
});

export class SapClient {
  private readonly base: string;

  constructor() {
    requireConfig(["SAP_ODATA_BASE_URL", "SAP_USER", "SAP_PASS"], "SAP OData");
    this.base = config().SAP_ODATA_BASE_URL!.replace(/\/?$/, "/");
  }

  private headers(): Record<string, string> {
    const c = config();
    return {
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from(`${c.SAP_USER}:${c.SAP_PASS}`).toString("base64"),
    };
  }

  private url(path: string, params: Record<string, string>): string {
    const c = config();
    const q = new URLSearchParams({ ...params, $format: "json" });
    if (c.SAP_CLIENT) q.set("sap-client", c.SAP_CLIENT);
    if (c.SAP_LANGUAGE) q.set("sap-language", c.SAP_LANGUAGE);
    // OData wants %20 not +
    return this.base + path + "?" + q.toString().replace(/\+/g, "%20");
  }

  /** GET every page of an entity set (server paging via __next, client paging via $skip). */
  async *pages(path: string, params: Record<string, string>, pageSize = 5000): AsyncGenerator<Record<string, unknown>[]> {
    let skip = 0;
    let next: string | undefined = this.url(path, { ...params, $top: String(pageSize), $skip: "0" });
    while (next) {
      const res = await request(next, { label: `SAP ${path}`, method: "GET", headers: this.headers() });
      const parsed = listEnvelope.safeParse(await res.json());
      if (!parsed.success) throw new SapShapeError(path, "missing d.results");
      const d = parsed.data.d;
      const results = Array.isArray(d) ? d : d.results;
      yield results;
      const serverNext = Array.isArray(d) ? undefined : d.__next;
      if (serverNext) next = serverNext.startsWith("http") ? serverNext : this.base + serverNext.replace(/^\//, "");
      else if (results.length === pageSize) {
        skip += pageSize;
        next = this.url(path, { ...params, $top: String(pageSize), $skip: String(skip) });
      } else next = undefined;
    }
  }

  /** Billing document lines, filtered by billing date and/or last change. */
  async *billingLines(filter: { dateFrom?: string; changedSince?: string }): AsyncGenerator<SapBillingLine[]> {
    const parts: string[] = [];
    if (filter.dateFrom) parts.push(`BillingDocumentDate ge datetime'${filter.dateFrom}T00:00:00'`);
    if (filter.changedSince) parts.push(`LastChangeDateTime ge datetimeoffset'${filter.changedSince}'`);
    const orgs = csv(config().SAP_SALES_ORGS);
    if (orgs.length) parts.push("(" + orgs.map((o) => `SalesOrganization eq '${o}'`).join(" or ") + ")");
    const params = {
      $filter: parts.join(" and "),
      $orderby: "BillingDocument",
      $expand: "to_Item",
      $select: [
        "BillingDocument", "BillingDocumentType", "SDDocumentCategory", "BillingDocumentDate", "SoldToParty",
        "SalesOrganization", "DistributionChannel", "Division", "BillingDocumentIsCancelled", "TransactionCurrency",
        "LastChangeDateTime",
        "to_Item/BillingDocumentItem", "to_Item/Material", "to_Item/BillingQuantity", "to_Item/BillingQuantityUnit",
        "to_Item/BillingQuantityInBaseUnit", "to_Item/BaseUnit", "to_Item/NetAmount", "to_Item/TaxAmount",
      ].join(","),
    };
    for await (const page of this.pages("API_BILLING_DOCUMENT_SRV/A_BillingDocument", params, 1000)) {
      const out: SapBillingLine[] = [];
      for (const h of page) {
        if (!("BillingDocument" in h)) throw new SapShapeError("A_BillingDocument", "no BillingDocument field");
        const itemsRaw = (h.to_Item as { results?: Record<string, unknown>[] } | undefined)?.results ?? [];
        const billingDate = odataDate(h.BillingDocumentDate)?.toISOString().slice(0, 10) ?? null;
        for (const it of itemsRaw) {
          out.push({
            billingDocument: String(h.BillingDocument),
            item: String(it.BillingDocumentItem),
            docType: str(h.BillingDocumentType),
            docCategory: str(h.SDDocumentCategory),
            billingDate,
            soldTo: padCustomer(str(h.SoldToParty)),
            salesOrg: str(h.SalesOrganization),
            distChannel: str(h.DistributionChannel),
            division: str(h.Division),
            material: str(it.Material),
            quantity: num(it.BillingQuantity),
            quantityUnit: str(it.BillingQuantityUnit),
            quantityBase: num(it.BillingQuantityInBaseUnit),
            baseUnit: str(it.BaseUnit),
            netAmount: num(it.NetAmount),
            taxAmount: num(it.TaxAmount),
            currency: str(h.TransactionCurrency),
            isCancelled: h.BillingDocumentIsCancelled === true || h.BillingDocumentIsCancelled === "X",
            lastChange: odataDate(h.LastChangeDateTime)?.toISOString() ?? null,
          });
        }
      }
      yield out;
    }
  }

  /** Material master with description and the conversion to the volume unit (m²). */
  async *materials(): AsyncGenerator<SapMaterial[]> {
    const volUnit = config().SAP_VOLUME_UNIT.toUpperCase();
    const lang = config().SAP_LANGUAGE.toUpperCase();
    const params = {
      $select: "Product,ProductType,ProductGroup,BaseUnit,to_Description/Language,to_Description/ProductDescription,to_ProductUnitsOfMeasure/AlternativeUnit,to_ProductUnitsOfMeasure/QuantityNumerator,to_ProductUnitsOfMeasure/QuantityDenominator",
      $expand: "to_Description,to_ProductUnitsOfMeasure",
    };
    for await (const page of this.pages("API_PRODUCT_SRV/A_Product", params, 1000)) {
      yield page.map((p) => {
        const descs = (p.to_Description as { results?: Record<string, unknown>[] } | undefined)?.results ?? [];
        const uoms = (p.to_ProductUnitsOfMeasure as { results?: Record<string, unknown>[] } | undefined)?.results ?? [];
        const baseUnit = str(p.BaseUnit);
        let volumePerBaseUnit: number | null = null;
        if (baseUnit?.toUpperCase() === volUnit) volumePerBaseUnit = 1;
        else {
          // 1 AlternativeUnit = QuantityNumerator/QuantityDenominator base units  =>  m² per base unit = den/num
          const u = uoms.find((x) => String(x.AlternativeUnit).toUpperCase() === volUnit);
          const n = num(u?.QuantityNumerator);
          const d = num(u?.QuantityDenominator);
          if (n && d) volumePerBaseUnit = d / n;
        }
        return {
          material: String(p.Product),
          description: str(descs.find((x) => String(x.Language).toUpperCase() === lang)?.ProductDescription ?? descs[0]?.ProductDescription),
          productType: str(p.ProductType),
          productGroup: str(p.ProductGroup),
          baseUnit,
          volumePerBaseUnit,
        };
      });
    }
  }

  /** One small call to check connectivity and print field names (used by `npm run sync:sap -- --probe`). */
  async probe(): Promise<{ header: string[]; item: string[] }> {
    const res = await request(this.url("API_BILLING_DOCUMENT_SRV/A_BillingDocument", { $top: "1", $expand: "to_Item" }), {
      label: "SAP probe",
      method: "GET",
      headers: this.headers(),
    });
    const body = listEnvelope.parse(await res.json());
    const rows = Array.isArray(body.d) ? body.d : body.d.results;
    const h = rows[0] ?? {};
    const it = ((h.to_Item as { results?: Record<string, unknown>[] } | undefined)?.results ?? [])[0] ?? {};
    log.info(`SAP probe OK: ${rows.length} document(s) returned`);
    return { header: Object.keys(h).filter((k) => !k.startsWith("__")), item: Object.keys(it).filter((k) => !k.startsWith("__")) };
  }
}
