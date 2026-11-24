// "RMI synced at …, SAP synced at …" with a warning when the latest sync failed or data is stale.
import { ensureSchema } from "@/db/migrate";
import { lastRuns } from "@/sync/runs";

const STALE_HOURS = 30; // daily job + margin

function isStale(iso: string | null | undefined): boolean {
  return !!iso && Date.now() - Date.parse(iso) > STALE_HOURS * 3600_000;
}

function when(iso?: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

export async function FreshnessBanner({ compact = false }: { compact?: boolean }) {
  await ensureSchema();
  const [rmi, sap] = await Promise.all([lastRuns("rmi"), lastRuns("sap")]);
  const problems: { level: "critical" | "warning"; text: string }[] = [];
  for (const [name, r] of [["RMI", rmi], ["SAP", sap]] as const) {
    if (r.latest?.status === "failed")
      problems.push({ level: "critical", text: `Last ${name} sync failed (${when(r.latest.startedAt)}): ${r.latest.error ?? "unknown error"}. Showing data from ${when(r.lastOk?.finishedAt)}.` });
    else if (r.latest?.status === "skipped") problems.push({ level: "warning", text: `${name} sync skipped: ${r.latest.message}` });
    else if (!r.lastOk) problems.push({ level: "warning", text: `${name} has never synced.` });
    else if (isStale(r.lastOk.finishedAt))
      problems.push({ level: "warning", text: `${name} data is more than ${STALE_HOURS} hours old (last synced ${when(r.lastOk.finishedAt)}).` });
  }

  if (compact) {
    return (
      <div className="text-[12px] text-ink-3 text-right leading-tight">
        <div>RMI synced {when(rmi.lastOk?.finishedAt)}</div>
        <div>SAP synced {when(sap.lastOk?.finishedAt)}</div>
      </div>
    );
  }
  if (!problems.length) return null;
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6 pt-4 space-y-2">
      {problems.map((p, i) => (
        <div
          key={i}
          role="alert"
          className="flex gap-2 items-start rounded-lg border px-3 py-2 text-[13px]"
          style={{
            background: p.level === "critical" ? "var(--banner-critical-bg)" : "var(--banner-warning-bg)",
            borderColor: p.level === "critical" ? "var(--status-critical)" : "var(--status-warning)",
          }}
        >
          <span aria-hidden className="font-bold" style={{ color: p.level === "critical" ? "var(--status-critical)" : "var(--status-warning)" }}>
            {p.level === "critical" ? "✕" : "!"}
          </span>
          <span>
            <strong>{p.level === "critical" ? "Sync failed. " : "Check data. "}</strong>
            {p.text}
          </span>
        </div>
      ))}
    </div>
  );
}
