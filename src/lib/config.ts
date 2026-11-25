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
  PG_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5), // Postgres connections per server instance

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
  // SAP's https certificate is self-signed (SAP HEC). Trust exactly that certificate, and check it against
  // its real name even though we connect by IP. Never disable certificate checks instead.
  SAP_TLS_CA_FILE: z.string().optional(), // e.g. ./certs/sap-prd.pem
  SAP_TLS_SERVERNAME: z.string().optional(), // e.g. vhntops4ci.sap.nitco.in
  SAP_SALES_ORGS: z.string().default(""), // comma list; blank = all
  // Billing document types. PENDING CONFIRMATION by the SAP team (docs/sap-api.md §4.6).
  SAP_SALES_DOC_TYPES: z.string().default("F2"),
  SAP_RETURN_DOC_TYPES: z.string().default("RE,G2"), // quantity and value come back (returns)
  SAP_VALUE_ONLY_DOC_TYPES: z.string().default(""), // credit notes that reduce value only (rate difference, claims)
  // Not decided yet whether these count as sales: kept apart, so reports can be made with and without them.
  SAP_EXTRA_DOC_TYPES: z.string().default("ZNTI,ZDMS"), // + quantity and value
  SAP_EXTRA_VALUE_ONLY_DOC_TYPES: z.string().default("ZTDN"), // + value only (debit notes)
  SAP_FIRST_BILLING_DATE: z.string().default("2025-03-01"),
  SAP_RECHECK_MONTHS: z.coerce.number().int().min(0).max(12).default(3),
  SAP_VOLUME_UNIT: z.string().default("M2"),

  // Cloud dashboard (e.g. Vercel + Neon). On the sync PC: the Postgres URL the daily job copies the dashboard tables to
  // (blank = don't publish). On Vercel: leave blank and set DATABASE_URL to the same Postgres, plus READ_ONLY=1.
  PUBLISH_DATABASE_URL: z.string().optional(),
  // Dashboard can't reach SAP/RMI (cloud host): hides "Refresh now" and blocks /api/refresh. Vercel sets VERCEL=1 itself.
  READ_ONLY: bool,
  // Sign-in: a random string of 32+ characters. When set (and always on Vercel), everyone must sign in.
  AUTH_SECRET: z.string().optional(),

  // Outputs
  REPORT_OUTPUT_DIR: z.string().default("./reports"),
  LOG_DIR: z.string().default("./logs"),

  // Optional email alert when the daily job fails (leave SMTP_HOST blank to switch off)
  ALERT_EMAIL_TO: z.string().optional(), // comma list
  SMTP_HOST: z.string().optional(), // e.g. smtp.gmail.com or the company relay
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

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

/** True where the dashboard can't sync itself (cloud host). */
export function isReadOnly(): boolean {
  return config().READ_ONLY || process.env.VERCEL === "1";
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
