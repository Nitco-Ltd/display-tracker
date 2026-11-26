// Reading and rebuilding the page's URL filters (?zone=…&zone=…). Next.js gives each one as a string or a list.
export type SearchParams = Record<string, string | string[] | undefined>;

/** A URL parameter as a list of non-empty values. */
export function paramList(v: string | string[] | undefined): string[] {
  return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
}

/** The current filters as a query string, without `omit` and with `set` overriding. */
export function toQuery(sp: SearchParams, { omit = [], set = {} }: { omit?: string[]; set?: Record<string, string> } = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (!omit.includes(k) && !(k in set)) for (const x of paramList(v)) p.append(k, x);
  for (const [k, v] of Object.entries(set)) p.set(k, v);
  return p.toString();
}
