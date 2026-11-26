// SAP S/4HANA OData (v2) adapter — the ONLY file that knows about SAP.
// READ-ONLY: this module only ever issues HTTP GET. Never add POST/PUT/PATCH/DELETE here.
// Services/fields are the standard S/4HANA APIs (API_BILLING_DOCUMENT_SRV, API_PRODUCT_SRV).
// STATUS: written against the standard API spec; not yet tested on NITCO's system (see docs/sap-api.md).
import { readFileSync } from "node:fs";
import { Agent } from "undici";
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
  storageLocation: string | null; // F-KA / S-KA = project-dealer sales (SAP_PROJECT_STORAGE_LOCATIONS)
  currency: string | null;
  exchangeRate: number | null; // INR per unit of `currency` (1 for INR invoices)
  isCancelled: boolean;
  cancelledDocument: string | null; // for cancellation documents (S1/S2/S3): the billing document they cancel
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
export interface SapCustomer {
  customer: string; // 10 digits, as RMI stores dealer codes
  name: string | null;
  fullName: string | null; // e.g. "Company SHREE SHYAM TILES/846004 DARBHANGA,"
  gstin: string | null; // TaxNumber3 (GST registration number)
  postalCode: string | null; // PIN code, from the full name ("…/846004 DARBHANGA")
  createdOn: string | null; // yyyy-mm-dd
  deleted: number; // 1 = marked for deletion
}

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
/** SAP's accounting exchange rate as rupees per unit of the invoice currency. */
export function exchangeRateToInr(rate: number | null, indirect: boolean): number | null {
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
  return indirect ? 1 / rate : rate;
}

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
  private readonly dispatcher: Agent | undefined;

  constructor() {
    const c = config();
    // Login: user + password (NITCO's system), or an api.sap.com API key (SAP's public sandbox, demo data).
    requireConfig(c.SAP_API_KEY && !c.SAP_PASS ? ["SAP_ODATA_BASE_URL"] : ["SAP_ODATA_BASE_URL", "SAP_USER", "SAP_PASS"], "SAP OData");
    this.base = c.SAP_ODATA_BASE_URL!.replace(/\/?$/, "/");
    if (c.SAP_TLS_CA_FILE || c.SAP_TLS_SERVERNAME) {
      this.dispatcher = new Agent({
        connect: {
          ca: c.SAP_TLS_CA_FILE ? readFileSync(c.SAP_TLS_CA_FILE, "utf8") : undefined,
          servername: c.SAP_TLS_SERVERNAME, // hostname checked against the certificate
          rejectUnauthorized: true,
        },
      });
    }
  }

  private get(url: string, label: string) {
    // Only GET, ever. `dispatcher` is Node's way to pass TLS options to fetch.
    return request(url, { label, method: "GET", headers: this.headers(), dispatcher: this.dispatcher } as Parameters<typeof request>[1]);
  }

  private headers(): Record<string, string> {
    const c = config();
    if (c.SAP_API_KEY && !c.SAP_PASS) return { Accept: "application/json", APIKey: c.SAP_API_KEY };
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
      const res = await this.get(next, `SAP ${path}`);
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
        "LastChangeDateTime", "AbsltAccountingExchangeRate", "AcctgExchangeRateIsIndrctQtan", "CancelledBillingDocument",
        "to_Item/BillingDocumentItem", "to_Item/Material", "to_Item/BillingQuantity", "to_Item/BillingQuantityUnit",
        "to_Item/BillingQuantityInBaseUnit", "to_Item/BaseUnit", "to_Item/NetAmount", "to_Item/TaxAmount", "to_Item/StorageLocation",
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
            storageLocation: str(it.StorageLocation),
            currency: str(h.TransactionCurrency),
            // Rupees per unit of the invoice currency (export invoices are often in USD); SAP may quote it indirectly.
            exchangeRate: exchangeRateToInr(num(h.AbsltAccountingExchangeRate), h.AcctgExchangeRateIsIndrctQtan === true),
            isCancelled: h.BillingDocumentIsCancelled === true || h.BillingDocumentIsCancelled === "X",
            cancelledDocument: str(h.CancelledBillingDocument), // set on S1/S2/S3: the document this one cancels
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

  /** Customer master (read-only): name and GST number, used to link a dealer's several SAP accounts. */
  async *customers(): AsyncGenerator<SapCustomer[]> {
    const params = { $select: "Customer,CustomerName,CustomerFullName,TaxNumber3,CreationDate,DeletionIndicator" };
    for await (const page of this.pages("API_BUSINESS_PARTNER/A_Customer", params, 5000)) {
      yield page.map((c) => ({
        customer: padCustomer(str(c.Customer))!,
        name: str(c.CustomerName),
        fullName: str(c.CustomerFullName),
        gstin: str(c.TaxNumber3)?.toUpperCase() ?? null,
        postalCode: str(c.CustomerFullName)?.match(/\/\s*(\d{6})\b/)?.[1] ?? null,
        createdOn: odataDate(c.CreationDate)?.toISOString().slice(0, 10) ?? null,
        deleted: c.DeletionIndicator ? 1 : 0,
      }));
    }
  }

  /** Each customer's sales district (zone, e.g. EZ1), sales office (region, e.g. BH1) and Customer Group 2
   *  (09 Key Account, 12 Retail Project, 10 Retail, …) per distribution channel in the sales org(s). */
  async *customerSalesAreas(): AsyncGenerator<
    { customer: string; salesOrg: string | null; channel: string | null; salesDistrict: string | null; salesOffice: string | null; customerGroup: string | null }[]
  > {
    const orgs = csv(config().SAP_SALES_ORGS);
    const params: Record<string, string> = { $select: "Customer,SalesOrganization,DistributionChannel,SalesDistrict,SalesOffice,AdditionalCustomerGroup2" };
    if (orgs.length) params.$filter = orgs.map((o) => `SalesOrganization eq '${o}'`).join(" or ");
    for await (const page of this.pages("API_BUSINESS_PARTNER/A_CustomerSalesArea", params, 5000)) {
      yield page.map((r) => ({
        customer: padCustomer(str(r.Customer))!,
        salesOrg: str(r.SalesOrganization),
        channel: str(r.DistributionChannel),
        salesDistrict: str(r.SalesDistrict),
        salesOffice: str(r.SalesOffice),
        customerGroup: str(r.AdditionalCustomerGroup2),
      }));
    }
  }

  /** One small call to check connectivity and print field names (used by `npm run sync:sap -- --probe`). */
  async probe(): Promise<{ header: string[]; item: string[] }> {
    const res = await this.get(this.url("API_BILLING_DOCUMENT_SRV/A_BillingDocument", { $top: "1", $expand: "to_Item" }), "SAP probe");
    const body = listEnvelope.parse(await res.json());
    const rows = Array.isArray(body.d) ? body.d : body.d.results;
    const h = rows[0] ?? {};
    const it = ((h.to_Item as { results?: Record<string, unknown>[] } | undefined)?.results ?? [])[0] ?? {};
    log.info(`SAP probe OK: ${rows.length} document(s) returned`);
    return { header: Object.keys(h).filter((k) => !k.startsWith("__")), item: Object.keys(it).filter((k) => !k.startsWith("__")) };
  }
}
