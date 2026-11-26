"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setState("running");
    setMsg("");
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState("done");
      setMsg(body.summary);
      router.refresh();
    } catch (e) {
      setState("error");
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === "running"}
        className="inline-flex items-center h-7 px-3 rounded-full text-[12px] font-medium text-[#161513] bg-[#e9e6df] hover:bg-white transition-colors disabled:opacity-60"
        title="Pull the latest data from RMI and SAP now, then rebuild the reports"
      >
        {state === "running" ? "Refreshing…" : "Refresh now"}
      </button>
      {msg && (
        <span className="text-[12px] max-w-[260px] truncate" style={{ color: state === "error" ? "var(--status-critical)" : "var(--text-muted)" }} title={msg}>
          {state === "error" ? "Failed: " : "✓ "}
          {msg}
        </span>
      )}
    </div>
  );
}
