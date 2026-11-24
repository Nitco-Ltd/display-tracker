// Normalizers for RMI free-text fields. Pure functions, unit-tested in tests/normalize.test.ts.
import { CASSETTE_TYPE, DISPLAYED_WHERE, PANEL_SIZE_OVERRIDES, PRODUCT_TYPE, lookupKey } from "./lookups";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "04 Aug 2026" -> "2026-08-04"; null if unparseable. */
export function parseRmiDate(s: string | null | undefined): string | null {
  const m = (s ?? "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "0011000111 - Concrete Concept" or "Concrete Concept" -> "0011000111 - Concrete Concept". */
export function normalizeDealerName(code: string | null | undefined, name: string | null | undefined): string | null {
  const c = (code ?? "").trim();
  const n = (name ?? "").trim();
  if (!n) return c || null;
  if (!c) return n;
  const stripped = n.replace(new RegExp(`^0*${c.replace(/^0+/, "")}\\s*-\\s*`), "");
  return `${c} - ${stripped}`;
}

function fromLookup(table: Record<string, string>, v: string | null | undefined): string | null {
  const k = lookupKey(v);
  if (!k) return null;
  return table[k] ?? (v ?? "").trim().replace(/\s+/g, " ");
}

export const normalizeDisplayedWhere = (v?: string | null) => fromLookup(DISPLAYED_WHERE, v);
export const normalizeCassetteType = (v?: string | null) => fromLookup(CASSETTE_TYPE, v);
export const normalizeProductType = (v?: string | null) => fromLookup(PRODUCT_TYPE, v);

/**
 * Panel size, larger side first, with unit:
 *   "8X4", "8  X  4", "8 H x 4 W", "4x8" -> "8x4 ft"
 *   "1200X2400", "1200 x 2400 mm"       -> "2400x1200 mm"
 *   "0", "3", blank                     -> null (Unknown)
 * Rule: both sides ≥ 100 means millimetres, otherwise feet.
 */
export function normalizePanelSize(v: string | null | undefined): string | null {
  const k = lookupKey(v);
  if (!k) return null;
  if (k in PANEL_SIZE_OVERRIDES) return PANEL_SIZE_OVERRIDES[k];
  const nums = k.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length !== 2) return null;
  const [a, b] = nums.map(Number).sort((x, y) => y - x);
  if (a === 0 || b === 0) return null;
  const unit = a >= 100 && b >= 100 ? "mm" : "ft";
  return `${a}x${b} ${unit}`;
}

/** Tile size in mm, orientation-insensitive, smaller side first: "600X1200" / "1200x600" -> "600x1200". */
export function normalizeTileSize(v: string | null | undefined): string {
  const nums = (v ?? "").match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return "";
  const [a, b] = nums.slice(0, 2).map(Number).sort((x, y) => x - y);
  return `${a}x${b}`;
}

/** Design-name key for matching: lowercase, punctuation → space, collapsed. */
export function designKey(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
