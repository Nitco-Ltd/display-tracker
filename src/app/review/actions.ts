"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, tables } from "@/db/client";
import { getViewer, canAdminister } from "@/auth/viewer";
import { rebuildDesignMap } from "@/sync/design-match";
import { nowIso } from "@/sync/runs";

async function guard() {
  const v = await getViewer();
  if (!canAdminister(v)) throw new Error("Only admins can change design links");
  return v;
}

/** Approve a candidate (or a manually typed SAP material code) for one design + size. */
export async function approve(form: FormData) {
  const v = await guard();
  const id = Number(form.get("id"));
  const manual = String(form.get("manual") ?? "").trim().toUpperCase();
  const picked = String(form.get("code") ?? "").trim();
  const code = manual || picked;
  if (!code) throw new Error("Pick a candidate or type a SAP material code");
  const t = tables();
  const db = getDb();
  const [mat] = await db.select().from(t.sapMaterial).where(eq(t.sapMaterial.material, code));
  const [prod] = await db.select().from(t.rmiProduct).where(eq(t.rmiProduct.productCode, code));
  if (!mat && !prod) throw new Error(`${code} is not a known SAP material`);
  await db
    .update(t.designMaterialMap)
    .set({
      materialCode: code,
      materialName: prod?.productName ?? mat?.description ?? null,
      status: manual ? "manual" : "approved",
      note: `${manual ? "typed" : "approved"} by ${v.name}`,
      updatedAt: nowIso(),
    })
    .where(eq(t.designMaterialMap.id, id));
  await rebuildDesignMap();
  revalidatePath("/", "layout");
}

export async function reject(form: FormData) {
  const v = await guard();
  const t = tables();
  await getDb()
    .update(t.designMaterialMap)
    .set({ materialCode: null, materialName: null, status: "rejected", note: `rejected by ${v.name}`, updatedAt: nowIso() })
    .where(eq(t.designMaterialMap.id, Number(form.get("id"))));
  await rebuildDesignMap();
  revalidatePath("/", "layout");
}

/** Undo a human decision: the design goes back to automatic matching. */
export async function reset(form: FormData) {
  await guard();
  const t = tables();
  await getDb().delete(t.designMaterialMap).where(eq(t.designMaterialMap.id, Number(form.get("id"))));
  await rebuildDesignMap();
  revalidatePath("/", "layout");
}
