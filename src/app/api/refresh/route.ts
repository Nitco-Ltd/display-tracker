import { getViewer, canAdminister } from "@/auth/viewer";
import { refreshAll } from "@/sync/refresh";

export const maxDuration = 600;

export async function POST() {
  if (!canAdminister(await getViewer())) return Response.json({ error: "Not allowed" }, { status: 403 });
  try {
    const summary = await refreshAll();
    return Response.json({ ok: true, summary });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
