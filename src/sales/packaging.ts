// Packaging variants (confirmed by the business owner, 2026-11-25): NITCO gives a design a new SAP code when only the
// packaging changes, e.g. Oyster Blue Onyx TIGVMPL1200X600NOGL02160 and …NOGL03021 (or Caspian Onyx …NOGL02003 / …NOGL0301).
// Such codes are identical except for the trailing serial number (4–6 digits) and carry the same design name; their sales
// count as the same design. Codes that differ anywhere else (e.g. DCH vs DTL, NO vs MH) are NOT merged: not confirmed.
import { designKey } from "@/lib/normalize";

export function packagingFamilyKey(code: string, description: string | null | undefined): string {
  const dk = designKey(description);
  const m = code.match(/^(.*\D)\d{4,6}$/);
  if (!m || !dk) return code;
  return `${m[1]}|${dk}`;
}
