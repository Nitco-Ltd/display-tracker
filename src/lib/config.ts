// All configuration comes from environment variables (.env locally, real env vars on a server).
// Never log values from here — several are secrets.
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

const schema = z.object({
  // Database: "file:./data/app.db" (SQLite) or "postgres://user:pass@host:5432/db" (Postgres).
  DATABASE_URL: z.string().default("file:./data/app.db"),

  // NITCO RMI web app (undocumented API, see docs/rmi-api.md)
  RMI_BASE_URL: z.string().default("https://rmi.nitco.in/api/NitcoRMI/"),
  RMI_USER: z.string().optional(),
  RMI_PASS: z.string().optional(),
  RMI_APP_KEY: z.string().optional(),
  RMI_CUSTOMER_ID: z.string().default("NitcoRMI"),

  // SAP S/4HANA OData (read-only, see docs/sap-api.md)
  SAP_ODATA_BASE_URL: z.string().optional(), // e.g. https://host:port/sap/opu/odata/sap/
  SAP_CLIENT: z.string().optional(), // sap-client, e.g. 100
  SAP_USER: z.string().optional(),
  SAP_PASS: z.string().optional(),
  SAP_API_KEY: z.string().optional(), // only for SAP's api.sap.com sandbox (demo data); NITCO's system uses user/password
  SAP_LANGUAGE: z.string().default("EN"),
  SAP_SALES_ORGS: z.string().default(""), // comma list; blank = all
  // Billing document types. PENDING CONFIRMATION by the SAP team (docs/sap-api.md §4.6).
  SAP_SALES_DOC_TYPES: z.string().default("F2"),
  SAP_RETURN_DOC_TYPES: z.string().default("RE,G2"),
  SAP_FIRST_BILLING_DATE: z.string().default("2025-03-01"),
  SAP_RECHECK_MONTHS: z.coerce.number().int().min(0).max(12).default(3),
  SAP_VOLUME_UNIT: z.string().default("M2"),

  // Outputs
  REPORT_OUTPUT_DIR: z.string().default("./reports"),

  // HTTP behaviour (both systems)
  HTTP_TIMEOUT_MS: z.coerce.number().int().default(60_000),
  RAW_PAYLOAD_RETENTION_DAYS: z.coerce.number().int().default(14),
  LOG_DEBUG: bool,
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;
export function config(): Config {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function csv(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function requireConfig<K extends keyof Config>(keys: K[], purpose: string): void {
  const c = config();
  const missing = keys.filter((k) => c[k] === undefined || c[k] === "");
  if (missing.length) {
    throw new Error(`${purpose}: missing ${missing.join(", ")} in .env (see .env.example)`);
  }
}
