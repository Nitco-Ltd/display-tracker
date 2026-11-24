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
      const reason = (e as Error).name === "AbortError" ? `timed out after ${timeoutMs} ms` : (e as Error).message;
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
