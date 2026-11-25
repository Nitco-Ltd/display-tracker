import { isReadOnly } from "@/lib/config";
import { getViewer, canAdminister } from "@/auth/viewer";
import { refreshAll } from "@/sync/refresh";

export const maxDuration = 300; // Vercel Hobby limit; refresh is disabled on Vercel anyway (READ_ONLY)

export async function POST() {
  if (isReadOnly()) return Response.json({ error: "This dashboard is read-only: data is refreshed by the scheduled job on the sync PC." }, { status: 403 });
  if (!canAdminister(await getViewer())) return Response.json({ error: "Not allowed" }, { status: 403 });
  try {
    const summary = await refreshAll();
    return Response.json({ ok: true, summary });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
