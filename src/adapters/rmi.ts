// NITCO RMI adapter — the ONLY file that knows about the RMI web app's API.
// The API is undocumented (built by SVIK Infotech); everything here was found by reading the web app's pages.
// See docs/rmi-api.md. If RMI changes, this file (and only this file) should need updating.
import { z } from "zod";
import { config, requireConfig } from "@/lib/config";
import { request } from "@/lib/http";
import { log } from "@/lib/log";
import { readXlsx, colLetter } from "@/lib/xlsx-read";

export class RmiShapeError extends Error {
  constructor(endpoint: string, detail: string) {
    super(`RMI ${endpoint} returned an unexpected shape (${detail}). The RMI app may have changed — see docs/rmi-api.md.`);
  }
}

// ---------- public types (what the rest of the app sees) ----------

export interface RmiListRow {
  id: number;
  refNo: string;
  displayDate: string | null; // "13 Sep 2025"
  dealerCode: string | null;
  status: string | null;
}

/** One row of the Display Tracker export = report columns A–U. */
export interface RmiDisplayRow {
  refNo: string;
  displayDate: string | null;
  rmiName: string | null;
  dealerCode: string | null;
  dealerName: string | null;
  dealerStatus: string | null;
  zone: string | null;
  region: string | null;
  location: string | null;
  dealerCategory: string | null;
  franchiseType: string | null;
  displayedWhere: string | null;
  cassetteType: string | null;
  cassetteNumber: string | null;
  panelNo: string | null;
  panelSize: string | null;
  productType: string | null;
  sizeMm: string | null;
  designName: string | null;
  designStatus: string | null;
  status: string | null;
}

export interface RmiProduct {
  productCode: string;
  productName: string;
  category: string;
  size: string;
}

// Expected export header, column A..U. Any difference = RMI changed the export → stop with a clear error.
export const EXPORT_COLUMNS: [keyof RmiDisplayRow, string][] = [
  ["refNo", "Sequence No"],
  ["displayDate", "Product Display Date"],
  ["rmiName", "RMI Name"],
  ["dealerCode", "Dealer Code"],
  ["dealerName", "Dealer Name"],
  ["dealerStatus", "Dealer Status"],
  ["zone", "Zone"],
  ["region", "Region"],
  ["location", "Location"],
  ["dealerCategory", "Dealer / Franchise"],
  ["franchiseType", "Franchise Type"],
  ["displayedWhere", "Displayed Where"],
  ["cassetteType", "Cassette Type"],
  ["cassetteNumber", "Cassette Number"],
  ["panelNo", "Panel No"],
  ["panelSize", "Panel Size"],
  ["productType", "Product Type"],
  ["sizeMm", "Size (MM)"],
  ["designName", "Design Name"],
  ["designStatus", "Design Status"],
  ["status", "Status"],
];

// ---------- client ----------

export class RmiClient {
  private token: string | undefined;

  constructor(private readonly base = config().RMI_BASE_URL) {}

  private appHeaders(): Record<string, string> {
    // Undocumented: every call needs the web app's static key + customer id, in addition to the bearer token.
    return { Authtoken: config().RMI_APP_KEY!, CustomerID: config().RMI_CUSTOMER_ID };
  }

  async login(): Promise<void> {
    requireConfig(["RMI_USER", "RMI_PASS", "RMI_APP_KEY"], "RMI login");
    const c = config();
    const res = await request(this.base + "Login", {
      label: "RMI Login",
      method: "POST",
      // Note: header names are case-insensitive; sending both CustomerID and CustomerId merges them into
      // "NitcoRMI, NitcoRMI" and RMI answers 403 "Unauthorized Company." So appHeaders() only, once.
      headers: { ...this.appHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ UserName: c.RMI_USER, Password: c.RMI_PASS, platform: 1, latitude: "", longitude: "" }),
    });
    const body: unknown = await res.json();
    // Undocumented: bad credentials return the JSON string "invalid" with HTTP 200.
    if (body === "invalid") throw new Error("RMI login rejected: check RMI_USER / RMI_PASS in .env");
    const parsed = z
      .array(z.object({ nrmitoken: z.string().min(10), franshiseeadmin: z.unknown().optional(), zonalmanager: z.unknown().optional() }))
      .min(1)
      .safeParse(body);
    if (!parsed.success) throw new RmiShapeError("Login", "no nrmitoken in response");
    this.token = parsed.data[0].nrmitoken;
    const admin = String(parsed.data[0].franshiseeadmin).toLowerCase() === "true";
    const zm = String(parsed.data[0].zonalmanager).toLowerCase() === "true";
    if (!admin) log.warn(`RMI account is not an admin${zm ? " (zonal manager)" : ""}; it may not see all zones`);
  }

  private async call(endpoint: string, init: { method: "GET" | "POST"; json?: unknown; form?: Record<string, string> }) {
    if (!this.token) await this.login();
    const headers: Record<string, string> = { ...this.appHeaders(), authorization: `Bearer ${this.token}` };
    let body: string | undefined;
    if (init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    } else if (init.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(init.form).toString();
    }
    return request(this.base + endpoint, { label: `RMI ${endpoint.split("/")[0]}`, method: init.method, headers, body });
  }

  /** All display records (9 fields) in one call. ~12k rows, ~1 s. */
  async getDisplayList(): Promise<{ rows: RmiListRow[]; raw: string }> {
    const res = await this.call("GetDisplayTrackerList", {
      method: "POST",
      // Undocumented: all filters blank = every record the account may see.
      form: { zone: "", empcode: "", displaydate: "", dealercode: "", category: "", size: "", productcode: "" },
    });
    const raw = await res.text();
    const parsed = z
      .array(
        z.object({
          DisplayTracker_Id: z.number(),
          RefrenceNo: z.string(), // sic — RMI's spelling
          DisplayDate: z.string().nullable(),
          Dealer_Code: z.string().nullable(),
          Status: z.string().nullable(),
        }),
      )
      .safeParse(JSON.parse(raw));
    if (!parsed.success) throw new RmiShapeError("GetDisplayTrackerList", parsed.error.issues[0]?.message ?? "invalid");
    return {
      raw,
      rows: parsed.data.map((r) => ({
        id: r.DisplayTracker_Id,
        refNo: r.RefrenceNo.trim(),
        displayDate: r.DisplayDate,
        dealerCode: r.Dealer_Code,
        status: r.Status,
      })),
    };
  }

  /** All display records with report columns A–U, via the list page's "Excel" export. One call, ~4 s, ~1 MB. */
  async getDisplayExport(): Promise<{ rows: RmiDisplayRow[]; rawBase64: string }> {
    const res = await this.call("ExcelDisplayTracker", {
      method: "POST",
      json: { zone: "", empcode: "", displaydate: "", dealercode: "", category: "", size: "", productcode: "" },
    });
    // Undocumented: the response body is the .xlsx file as bare base64 text (sometimes JSON-quoted).
    const rawBase64 = (await res.text()).trim().replace(/^"|"$/g, "");
    if (!/^UEsDB/.test(rawBase64)) throw new RmiShapeError("ExcelDisplayTracker", "body is not a base64 xlsx");
    const sheet = readXlsx(new Uint8Array(Buffer.from(rawBase64, "base64")));
    return { rawBase64, rows: mapExportRows(sheet.header, sheet.rows) };
  }

  /** Product catalogue: category -> sizes -> products. ~26 small calls; run weekly. */
  async getProductCatalog(): Promise<RmiProduct[]> {
    const cats = z.array(z.object({ Category: z.string() })).parse(await (await this.call("GetCategoryProductType", { method: "GET" })).json());
    const out: RmiProduct[] = [];
    for (const { Category } of cats) {
      const sizes = z
        .array(z.object({ Size: z.string() }))
        .parse(await (await this.call(`GetCategorySize/${encodeURIComponent(Category)}`, { method: "GET" })).json());
      for (const { Size } of sizes) {
        const prods = z
          .array(z.object({ ProductCode: z.string(), ProductName: z.string() }))
          .parse(
            await (
              await this.call(`GetCategoryProducts/${encodeURIComponent(Category)}/${encodeURIComponent(Size)}`, { method: "GET" })
            ).json(),
          );
        for (const p of prods) out.push({ productCode: p.ProductCode.trim(), productName: p.ProductName.trim(), category: Category, size: Size });
      }
    }
    return out;
  }
}

export function mapExportRows(header: Record<string, string>, rows: Record<string, string>[]): RmiDisplayRow[] {
  const letters = EXPORT_COLUMNS.map((_, i) => colLetter(i + 1)); // A..U
  const got = letters.map((l) => header[l]?.trim());
  const want = EXPORT_COLUMNS.map(([, h]) => h);
  if (Object.keys(header).length !== want.length || got.some((h, i) => h !== want[i])) {
    throw new RmiShapeError("ExcelDisplayTracker", `header changed: got [${got.join(" | ")}]`);
  }
  return rows
    .map((r) => {
      const o = {} as RmiDisplayRow;
      EXPORT_COLUMNS.forEach(([key], i) => {
        const v = r[letters[i]];
        (o as unknown as Record<string, string | null>)[key] = v === undefined || v.trim() === "" ? null : v.trim();
      });
      return o;
    })
    .filter((o) => o.refNo);
}
