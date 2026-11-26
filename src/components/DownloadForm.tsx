"use client";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { Icon } from "./Icon";
import type { FilterOptions } from "@/analytics/data";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}-${y}`;
}

export function DownloadForm({ options, initialMonth }: { options: FilterOptions; initialMonth?: string }) {
  const first = initialMonth && options.months.includes(initialMonth) ? initialMonth : options.months[0];
  const [v, setV] = useState<Record<string, string[]>>({ month: first ? [first] : [] });
  const [error, setError] = useState("");
  const set = (k: string) => (vals: string[]) => setV((s) => ({ ...s, [k]: vals }));
  const o = (vals: string[]) => vals.map((x) => ({ value: x, label: x }));

  const download = () => {
    if (!v.month?.length) return setError("Choose a display month.");
    setError("");
    const p = new URLSearchParams();
    for (const [k, vals] of Object.entries(v)) for (const x of vals) p.append(k, x);
    window.location.href = `/api/report?${p.toString()}`;
  };

  return (
    <div className="card p-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelect single label="Display month" options={options.months.map((m) => ({ value: m, label: monthLabel(m) }))} selected={v.month ?? []} onChange={set("month")} />
        <MultiSelect label="Zone" options={o(options.zones)} selected={v.zone ?? []} onChange={set("zone")} />
        <MultiSelect label="RMI" options={o(options.rmis)} selected={v.rmi ?? []} onChange={set("rmi")} />
        <MultiSelect label="Dealer" options={options.dealers.map((d) => ({ value: d.code, label: d.name }))} selected={v.dealer ?? []} onChange={set("dealer")} />
        <MultiSelect label="Product type" options={o(options.ptypes)} selected={v.ptype ?? []} onChange={set("ptype")} />
        <MultiSelect label="Size (mm)" options={o(options.sizes)} selected={v.size ?? []} onChange={set("size")} />
        <MultiSelect label="Design" options={o(options.designs)} selected={v.design ?? []} onChange={set("design")} />
        <MultiSelect
          single
          label="Sales counted"
          options={[
            { value: "0", label: "Standard sales" },
            { value: "1", label: "Include debit notes & samples" },
          ]}
          selected={v.extra?.length ? v.extra : ["0"]}
          onChange={(vals) => set("extra")(vals.includes("1") ? ["1"] : [])}
        />
        <div className="flex items-end">
          <button onClick={download} className="btn btn-primary w-full h-[42px] !rounded-[8px]">
            <Icon name="download" size={16} />
            Download Excel
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="mt-3 text-[13px]" style={{ color: "var(--status-critical)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
