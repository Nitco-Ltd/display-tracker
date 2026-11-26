// Packaging variants. A NITCO tile code ends in <2-digit tiles per box><serial>, e.g. TIGVMPL1200X600NOGL 02 160:
// 02 = 2 tiles a box (1.44 m² for 1200x600), 03 = 3 tiles (2.16 m²) … (business owner, 2026-11-26; SAP box sizes agree).
// When NITCO changes the box, the design gets a new code (Oyster Blue Onyx …NOGL02160 → …NOGL03021, from Apr 2026).
// Rule agreed 2026-11-26: codes count as ONE tile when
//   - both are tile codes (start with "TI") and neither is named "Not to use",
//   - they are identical up to the trailing 4–6 digits (same line, size, finish: DTL vs DTM or GL vs MA never merge),
//   - they carry the same design name.
// Codes with the same box digits but another serial (Urbano Frost Decor 03011 / 03015) are merged too, but listed by
// sameBoxTwins() so a person can check them: so far each such extra code has never been invoiced.
import { designKey } from "@/lib/normalize";

const NOT_A_TILE_NAME = /^not\s*to\s*use/i;

export function packagingFamilyKey(code: string, description: string | null | undefined): string {
  if (!code.startsWith("TI") || !description || NOT_A_TILE_NAME.test(description.trim())) return code;
  const dk = designKey(description);
  const m = code.match(/^(.*\D)\d{4,6}$/);
  if (!m || !dk) return code;
  return `${m[1]}|${dk}`;
}

/** "02" from TIGVMPL1200X600NOGL02160: tiles per box (null when the code has no serial tail). */
export function boxDigits(code: string): string | null {
  return code.match(/\D(\d\d)\d{2,4}$/)?.[1] ?? null;
}

/** Families (lists of codes) in which two codes share the same box digits: merged, but worth a person's look. */
export function sameBoxTwins(families: Iterable<string[]>): string[][] {
  const out: string[][] = [];
  for (const codes of families) {
    const seen = new Set<string>();
    if (codes.some((c) => { const b = boxDigits(c); if (!b) return false; if (seen.has(b)) return true; seen.add(b); return false; })) out.push(codes);
  }
  return out;
}
