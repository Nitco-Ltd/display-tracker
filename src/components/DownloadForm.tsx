"use client";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { Icon } from "./Icon";
import type { FilterOptions } from "@/analytics/data";
import { monthYear } from "@/lib/format";


export function DownloadForm({ options, initialMonth }: { options: FilterOptions; initialMonth?: string }) {
  const first = initialMonth && options.months.includes(initialMonth) ? initialMonth : options.months[0];
  const [v, setV] = useState<Record<string, string[]>>({ month: first ? [first] : [] });
  const [error, setError] = useState("");
  const set = (k: string) => (vals: string[]) => setV((s) => ({ ...s, [k]: vals }));
  const o = (vals: string[]) => vals.map((x) => ({ value: x, label: x }));

  // A plain link to the file (the browser downloads it); blocked with a message until a month is chosen.
  const query = new URLSearchParams();
  for (const [k, vals] of Object.entries(v)) for (const x of vals) query.append(k, x);
  const onDownload = (e: React.MouseEvent) => {
    if (v.month?.length) return setError("");
    e.preventDefault();
    setError("Choose a display month.");
  };

  return (
    <div className="card p-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelect single label="Display month" options={options.months.map((m) => ({ value: m, label: monthYear(m) }))} selected={v.month ?? []} onChange={set("month")} />
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
        <MultiSelect
          single
          label="Customers"
          options={[
            { value: "total", label: "Total" },
            { value: "retail", label: "Retail (without key accounts)" },
          ]}
          selected={v.scope?.length ? v.scope : ["total"]}
          onChange={(vals) => set("scope")(vals.includes("retail") ? ["retail"] : [])}
        />
        <MultiSelect
          single
          label="Project dealers"
          options={[
            { value: "with", label: "With project dealers" },
            { value: "without", label: "Without project dealers" },
          ]}
          selected={v.pd?.length ? v.pd : ["with"]}
          onChange={(vals) => set("pd")(vals.includes("without") ? ["without"] : [])}
        />
        <div className="flex items-end">
          <a href={`/api/report?${query.toString()}`} onClick={onDownload} className="btn btn-primary w-full h-[42px] !rounded-[8px]">
            <Icon name="download" size={16} />
            Download Excel
          </a>
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
