// Design name -> material code mapping (`design_material_map`).
//
// Rules (shown to the business owner at the Phase 1 checkpoint):
//   1. exact_name     Same normalized name as exactly one product code             -> status "auto"   (used)
//   2. name_and_size  Same name, several codes, exactly one with the display's size -> status "auto"   (used)
//   3. ambiguous      Same name, several codes, size doesn't decide                -> "needs_review" (NOT used)
//   4. fuzzy          Similar name (Dice ≥ 0.75), best candidate proposed          -> "needs_review" (NOT used)
//   5. none           Nothing similar                                               -> "unmapped"
// Rows with "approved", "manual" or "rejected" status were set by a person and are never overwritten.
// Sales are attached only for "auto", "approved" and "manual". We never silently guess.
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db/client";
import { upsertMany } from "@/db/upsert";
import { designKey, normalizeTileSize } from "@/lib/normalize";
import { nowIso } from "./runs";

export interface Candidate {
  code: string;
  name: string;
  sizeKey: string;
  source: "rmi" | "sap";
}

export const USABLE_STATUSES = new Set(["auto", "approved", "manual"]);
const HUMAN_STATUSES = new Set(["approved", "manual", "rejected"]);

/** Size from a NITCO material code, e.g. TIGVMPL1200X600NOGL02140 -> "600x1200". */
export function sizeFromCode(code: string): string {
  const m = code.match(/(\d{3,4})X(\d{3,4})/i);
  return m ? normalizeTileSize(`${m[1]}x${m[2]}`) : "";
}

function bigrams(s: string): Map<string, number> {
  const t = ` ${s} `;
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Dice similarity on character bigrams, 0..1. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  for (const [g, n] of A) {
    inter += Math.min(n, B.get(g) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

export interface MatchResult {
  materialCode: string | null;
  materialName: string | null;
  method: "exact_name" | "name_and_size" | "ambiguous" | "fuzzy" | "none";
  confidence: number;
  status: "auto" | "needs_review" | "unmapped";
  candidates: Candidate[];
}

export function matchDesign(dKey: string, sizeKey: string, catalog: Candidate[], byName: Map<string, Candidate[]>): MatchResult {
  const exact = byName.get(dKey) ?? [];
  const codes = [...new Map(exact.map((c) => [c.code, c])).values()];
  if (codes.length === 1) {
    return { materialCode: codes[0].code, materialName: codes[0].name, method: "exact_name", confidence: 1, status: "auto", candidates: [] };
  }
  if (codes.length > 1) {
    const sized = codes.filter((c) => c.sizeKey && c.sizeKey === sizeKey);
    if (sized.length === 1) {
      return { materialCode: sized[0].code, materialName: sized[0].name, method: "name_and_size", confidence: 0.95, status: "auto", candidates: [] };
    }
    return { materialCode: null, materialName: null, method: "ambiguous", confidence: 0, status: "needs_review", candidates: (sized.length ? sized : codes).slice(0, 5) };
  }
  // Fuzzy: best similar names; prefer same size.
  const scored = catalog
    .map((c) => ({ c, s: similarity(dKey, designKey(c.name)) + (sizeKey && c.sizeKey === sizeKey ? 0.05 : 0) }))
    .filter((x) => x.s >= 0.75)
    .sort((a, b) => b.s - a.s);
  if (scored.length) {
    const best = scored[0];
    return {
      materialCode: best.c.code,
      materialName: best.c.name,
      method: "fuzzy",
      confidence: Math.min(0.99, +best.s.toFixed(3)),
      status: "needs_review",
      candidates: scored.slice(0, 5).map((x) => x.c),
    };
  }
  return { materialCode: null, materialName: null, method: "none", confidence: 0, status: "unmapped", candidates: [] };
}

/** Rebuild the map for every distinct design in rmi_display, then stamp material_code/map_status on each row. */
export async function rebuildDesignMap(): Promise<Record<string, number>> {
  const db = getDb();
  const t = tables();

  const products = await db.select().from(t.rmiProduct);
  const materials = await db.select().from(t.sapMaterial);
  const catalog: Candidate[] = [
    ...products.map((p) => ({ code: p.productCode, name: p.productName, sizeKey: normalizeTileSize(p.size) || sizeFromCode(p.productCode), source: "rmi" as const })),
    ...materials
      .filter((m) => m.description && !products.some((p) => p.productCode === m.material))
      .map((m) => ({ code: m.material, name: m.description!, sizeKey: sizeFromCode(m.material), source: "sap" as const })),
  ];
  const byName = new Map<string, Candidate[]>();
  for (const c of catalog) {
    const k = designKey(c.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(c);
  }

  const rows = await db
    .select({
      refNo: t.rmiDisplay.refNo,
      designName: t.rmiDisplay.designName,
      sizeMm: t.rmiDisplay.sizeMm,
      materialCode: t.rmiDisplay.materialCode,
      mapStatus: t.rmiDisplay.mapStatus,
    })
    .from(t.rmiDisplay);
  const groups = new Map<string, { dKey: string; sKey: string; name: string; size: string | null; refs: string[] }>();
  for (const r of rows) {
    const dKey = designKey(r.designName);
    if (!dKey) continue;
    const sKey = normalizeTileSize(r.sizeMm);
    const k = `${dKey}|${sKey}`;
    if (!groups.has(k)) groups.set(k, { dKey, sKey, name: r.designName!, size: r.sizeMm, refs: [] });
    groups.get(k)!.refs.push(r.refNo);
  }

  const existing = new Map((await db.select().from(t.designMaterialMap)).map((m) => [`${m.designKey}|${m.sizeKey}`, m]));
  const now = nowIso();
  const upserts: (typeof t.designMaterialMap.$inferInsert)[] = [];
  const decided = new Map<string, { code: string | null; status: string }>();
  for (const [k, g] of groups) {
    const prev = existing.get(k);
    if (prev && HUMAN_STATUSES.has(prev.status)) {
      decided.set(k, { code: prev.materialCode, status: prev.status });
      upserts.push({ ...prev, rowCount: g.refs.length, updatedAt: prev.updatedAt });
      continue;
    }
    const m = matchDesign(g.dKey, g.sKey, catalog, byName);
    decided.set(k, { code: m.materialCode, status: m.status });
    upserts.push({
      designKey: g.dKey,
      sizeKey: g.sKey,
      designName: g.name,
      sizeMm: g.size,
      materialCode: m.materialCode,
      materialName: m.materialName,
      method: m.method,
      confidence: m.confidence,
      status: m.status,
      candidates: m.candidates.length ? JSON.stringify(m.candidates) : null,
      rowCount: g.refs.length,
      updatedAt: now,
    });
  }
  // Strip ids so upsert works on both dialects.
  await upsertMany(
    t.designMaterialMap,
    upserts.map(({ id: _id, ...u }) => u),
    [t.designMaterialMap.designKey, t.designMaterialMap.sizeKey],
  );

  // Stamp display rows.
  const stats: Record<string, number> = { mapped: 0, needs_review: 0, unmapped: 0, no_design: 0 };
  const rowUpdates: { refNo: string; materialCode: string | null; mapStatus: string }[] = [];
  for (const r of rows) {
    const dKey = designKey(r.designName);
    let code: string | null = null;
    let status = "no_design";
    if (dKey) {
      const d = decided.get(`${dKey}|${normalizeTileSize(r.sizeMm)}`)!;
      if (USABLE_STATUSES.has(d.status)) {
        code = d.code;
        status = "mapped";
      } else status = d.status === "needs_review" ? "needs_review" : "unmapped";
    }
    stats[status]++;
    if (r.materialCode === code && r.mapStatus === status) continue; // unchanged
    rowUpdates.push({ refNo: r.refNo, materialCode: code, mapStatus: status });
  }
  await db.transaction(async (tx) => {
    for (const u of rowUpdates) {
      await tx
        .update(t.rmiDisplay)
        .set({ materialCode: u.materialCode, mapStatus: u.mapStatus })
        .where(eq(t.rmiDisplay.refNo, u.refNo));
    }
  });
  return stats;
}
