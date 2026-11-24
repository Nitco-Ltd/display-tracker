// fetch with timeout + retry (max 3 attempts, exponential backoff). Shared by both adapters.
import { config } from "./config";
import { log, redact } from "./log";

export class HttpError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export interface RequestOpts extends RequestInit {
  label: string; // human-readable name for logs/errors, e.g. "RMI GetDisplayTrackerList"
  timeoutMs?: number;
  retries?: number; // total attempts, default 3
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HINTS: Record<string, string> = {
  ECONNREFUSED: "connection refused — is the server address/port right?",
  ENOTFOUND: "server name not found — check the address and the internet/VPN connection",
  EHOSTUNREACH: "server unreachable — for SAP, connect to the office network or VPN",
  ETIMEDOUT: "connection timed out — for SAP, connect to the office network or VPN",
  ECONNRESET: "connection dropped by the server",
  DEPTH_ZERO_SELF_SIGNED_CERT: "server certificate not trusted — check SAP_TLS_CA_FILE (README: SAP certificate)",
  SELF_SIGNED_CERT_IN_CHAIN: "server certificate not trusted — check SAP_TLS_CA_FILE (README: SAP certificate)",
  ERR_TLS_CERT_ALTNAME_INVALID: "certificate name mismatch — check SAP_TLS_SERVERNAME",
  CERT_HAS_EXPIRED: "server certificate expired — run `npm run sap:cert` after IT renews it",
};

/** Turns Node's generic "fetch failed" into the real cause with a plain-English hint. */
export function describeNetworkError(e: unknown): string {
  const err = e as Error & { cause?: { code?: string; message?: string } };
  const code = err.cause?.code;
  if (code) return `${code}: ${HINTS[code] ?? err.cause?.message ?? err.message}`;
  return err.message;
}

export async function request(url: string, opts: RequestOpts): Promise<Response> {
  const { label, timeoutMs = config().HTTP_TIMEOUT_MS, retries = 3, ...init } = opts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const t0 = Date.now();
      const res = await fetch(url, { ...init, signal: ac.signal });
      log.debug(`${label}: HTTP ${res.status} in ${Date.now() - t0} ms`);
      // Retry only on server errors / throttling; 4xx are permanent (bad request, auth).
      if (res.status >= 500 || res.status === 429) {
        throw new HttpError(`${label}: server returned HTTP ${res.status}`, res.status);
      }
      if (!res.ok) {
        const body = redact((await res.text()).slice(0, 300));
        throw Object.assign(new HttpError(`${label}: HTTP ${res.status} ${body}`, res.status), {
          permanent: true,
        });
      }
      return res;
    } catch (e) {
      lastErr = e;
      if ((e as { permanent?: boolean }).permanent) throw e;
      const reason = (e as Error).name === "AbortError" ? `timed out after ${timeoutMs} ms` : describeNetworkError(e);
      if (attempt < retries) {
        const wait = 2000 * 2 ** (attempt - 1); // 2 s, 4 s
        log.warn(`${label}: attempt ${attempt}/${retries} failed (${reason}); retrying in ${wait / 1000} s`);
        await sleep(wait);
      } else {
        throw new HttpError(`${label}: failed after ${retries} attempts (${reason})`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
