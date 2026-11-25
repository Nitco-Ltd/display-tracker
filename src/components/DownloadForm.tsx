"use client";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import type { FilterOptions } from "@/analytics/data";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}-${y}`;
}

export function DownloadForm({ options }: { options: FilterOptions }) {
  const [v, setV] = useState<Record<string, string[]>>({ month: options.months[0] ? [options.months[0]] : [] });
  const [error, setError] = useState("");
  const set = (k: string) => (vals: string[]) => setV((s) => ({ ...s, [k]: vals }));
  const o = (vals: string[]) => vals.map((x) => ({ value: x, label: x }));

  const download = () => {
    if (!v.month?.length) return setError("Please select display month & year.");
    setError("");
    const p = new URLSearchParams();
    for (const [k, vals] of Object.entries(v)) for (const x of vals) p.append(k, x);
    window.location.href = `/api/report?${p.toString()}`;
  };

  return (
    <div className="card p-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelect single label="Display Month & Year *" options={options.months.map((m) => ({ value: m, label: monthLabel(m) }))} selected={v.month ?? []} onChange={set("month")} />
        <MultiSelect label="Zone" options={o(options.zones)} selected={v.zone ?? []} onChange={set("zone")} />
        <MultiSelect label="RMI Name" options={o(options.rmis)} selected={v.rmi ?? []} onChange={set("rmi")} />
        <MultiSelect label="Dealer" options={options.dealers.map((d) => ({ value: d.code, label: d.name }))} selected={v.dealer ?? []} onChange={set("dealer")} />
        <MultiSelect label="Product Type" options={o(options.ptypes)} selected={v.ptype ?? []} onChange={set("ptype")} />
        <MultiSelect label="Size (MM)" options={o(options.sizes)} selected={v.size ?? []} onChange={set("size")} />
        <MultiSelect label="Design Name" options={o(options.designs)} selected={v.design ?? []} onChange={set("design")} />
        <MultiSelect
          single
          label="Sales counted"
          options={[
            { value: "0", label: "Without ZTDN, ZNTI, ZDMS" },
            { value: "1", label: "With ZTDN, ZNTI, ZDMS" },
          ]}
          selected={v.extra?.length ? v.extra : ["0"]}
          onChange={(vals) => set("extra")(vals.includes("1") ? ["1"] : [])}
        />
        <div className="flex items-end">
          <button onClick={download} className="w-full rounded-md px-4 py-2 text-[13px] font-medium bg-accent text-white">
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
