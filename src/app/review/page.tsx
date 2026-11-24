import { desc, inArray } from "drizzle-orm";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { getViewer, canAdminister } from "@/auth/viewer";
import { Section } from "@/components/Kpi";
import type { Candidate } from "@/sync/design-match";
import { inr, num } from "@/lib/format";
import { approve, reject, reset } from "./actions";

const METHOD: Record<string, string> = {
  ambiguous: "Several SAP materials share this name",
  size_mismatch: "Name matches, but the product's size differs from the size on the display",
  fuzzy: "No exact name; closest similar names",
  none: "Nothing similar found",
};

export default async function Review() {
  await ensureSchema();
  const viewer = await getViewer();
  const admin = canAdminister(viewer);
  const db = getDb();
  const t = tables();
  const open = await db.select().from(t.designMaterialMap).where(inArray(t.designMaterialMap.status, ["needs_review", "unmapped"])).orderBy(desc(t.designMaterialMap.rowCount));
  const decided = await db.select().from(t.designMaterialMap).where(inArray(t.designMaterialMap.status, ["approved", "manual", "rejected"])).orderBy(desc(t.designMaterialMap.updatedAt));

  // SAP sales per candidate code (all dealers), to help choose.
  const codes = [...new Set(open.flatMap((m) => (m.candidates ? (JSON.parse(m.candidates) as Candidate[]).map((c) => c.code) : [])))];
  const salesBy = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 500) {
    for (const s of await db.select({ m: t.sapSalesMonthly.materialCode, v: t.sapSalesMonthly.value }).from(t.sapSalesMonthly).where(inArray(t.sapSalesMonthly.materialCode, codes.slice(i, i + 500))))
      salesBy.set(s.m, (salesBy.get(s.m) ?? 0) + s.v);
  }
  const rows = open.reduce((a, m) => a + (m.rowCount ?? 0), 0);

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-[18px] font-semibold mb-1">Design review</h1>
      <p className="text-[13px] text-ink-2 mb-4">
        {num(open.length)} designs ({num(rows)} display rows) could not be linked to a SAP material automatically, so their displays get no sales yet. Pick the
        right material, type a code, or reject. Your decision is kept on every future sync.
      </p>
      {!admin && <p className="text-[13px] mb-4">Only admins can change links.</p>}

      {open.map((m) => {
        const cands: Candidate[] = m.candidates ? JSON.parse(m.candidates) : [];
        return (
          <form key={m.id} className="card p-4 mb-3" action={approve}>
            <input type="hidden" name="id" value={m.id} />
            <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
              <span className="font-semibold">{m.designName}</span>
              <span className="text-[13px] text-ink-2">{m.sizeMm}</span>
              <span className="text-[12px] text-ink-3">
                {num(m.rowCount ?? 0)} display rows · {METHOD[m.method] ?? m.method}
              </span>
            </div>
            {cands.length > 0 && (
              <div className="space-y-1 mb-3">
                {cands.map((c, i) => (
                  <label key={c.code} className="flex flex-wrap items-center gap-x-3 text-[13px] cursor-pointer">
                    <input type="radio" name="code" value={c.code} disabled={!admin} />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-ink-3">{c.code}</span>
                    <span className="text-ink-3">{c.sizeKey}</span>
                    <span className="text-ink-2">SAP sales since Mar-25: {inr(salesBy.get(c.code) ?? 0)}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input name="manual" placeholder="or type a SAP material code" className="rounded border border-line bg-surface-0 px-2 py-1 text-[13px] w-[280px]" disabled={!admin} />
              <button className="rounded-md px-3 py-1.5 text-[13px] font-medium bg-accent text-white disabled:opacity-50" disabled={!admin}>
                Link
              </button>
              <button formAction={reject} formNoValidate className="rounded-md px-3 py-1.5 text-[13px] border border-line disabled:opacity-50" disabled={!admin}>
                No match
              </button>
            </div>
          </form>
        );
      })}

      {decided.length > 0 && (
        <Section title={`Decided (${decided.length})`} note="Undo sends a design back to automatic matching.">
          <table className="data">
            <thead>
              <tr>
                <th>Design</th>
                <th>Size</th>
                <th>Decision</th>
                <th>SAP material</th>
                <th className="num">Rows</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {decided.map((m) => (
                <tr key={m.id}>
                  <td>{m.designName}</td>
                  <td>{m.sizeMm}</td>
                  <td>{m.status === "rejected" ? "No match" : m.status === "manual" ? "Typed code" : "Approved"}</td>
                  <td className="text-ink-2">{m.materialCode ? `${m.materialName ?? ""} · ${m.materialCode}` : "–"}</td>
                  <td className="num">{num(m.rowCount ?? 0)}</td>
                  <td>
                    <form action={reset}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="text-[12px] text-accent" disabled={!admin}>
                        Undo
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
